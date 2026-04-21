import { NextResponse } from 'next/server'
import { db } from '@/db'
import { customers, invoices, incomingPayments } from '@/db/schema'
import { and, eq, like } from 'drizzle-orm'
import { tryAutoIssueForPayment } from '@/lib/cwt/issue'

// POST /api/demo/simulate-cwt-payment
// Writes a 95 % payment against the reserved "(Demo Corp)" tenant's oldest
// unpaid invoice, fires the auto-issuance engine, returns timings + toast copy.
export async function POST() {
  const [tenant] = await db.select().from(customers).where(like(customers.name, '%(Demo Corp)')).limit(1)
  if (!tenant) return NextResponse.json({ error: 'demo tenant not seeded' }, { status: 500 })

  const [invoice] = await db.select().from(invoices).where(and(
    eq(invoices.customerId, tenant.customerId), eq(invoices.status, 'PENDING')
  )).limit(1)
  if (!invoice) return NextResponse.json({ error: 'no open invoice on demo tenant' }, { status: 500 })

  const amount = (Number(invoice.amount) * 0.95).toFixed(2)
  const [payment] = await db.insert(incomingPayments).values({
    invoiceId: invoice.invoiceId, customerId: tenant.customerId,
    amount, paymentMethod: 'BANK_TRANSFER',
    referenceNumber: 'BPI-' + Date.now(),
    status: 'CONFIRMED', confirmedAt: new Date(),
  } as any).returning()

  const result = await tryAutoIssueForPayment(payment.paymentId)

  return NextResponse.json({
    timings: [
      { at: 500, toast: `Bank transfer received — ${tenant.name.replace(' (Demo Corp)','')} · ₱${Number(amount).toLocaleString()}` },
      { at: 1500, toast: `CWT gap detected: ₱${(Number(invoice.amount) * 0.05).toLocaleString()} @ 5.00% · ATC WC100` },
      { at: 2500, toast: `BIR 2307 rendered · ref ${(result as any).referenceNumber ?? '—'}` },
      { at: 3500, toast: `Invoice INV-${invoice.invoiceNumber} closed · tenant notified` },
    ],
    certificateId: (result as any).certificateId,
    invoiceId: invoice.invoiceId,
  })
}
