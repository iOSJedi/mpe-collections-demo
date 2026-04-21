import { NextResponse } from 'next/server'
import { db } from '@/db'
import { customers, invoices, incomingPayments, cwtCertificates } from '@/db/schema'
import { eq, like } from 'drizzle-orm'

export async function POST() {
  const [tenant] = await db.select().from(customers).where(like(customers.name, '%(Demo Corp)')).limit(1)
  if (!tenant) return NextResponse.json({ ok: true, note: 'no demo tenant found' })

  await db.delete(cwtCertificates).where(eq(cwtCertificates.customerId, tenant.customerId))
  await db.delete(incomingPayments).where(eq(incomingPayments.customerId, tenant.customerId))

  const tenantInvoices = await db.select().from(invoices).where(eq(invoices.customerId, tenant.customerId))
  for (const inv of tenantInvoices) {
    await db.update(invoices).set({
      status: 'PENDING',
      balanceRemaining: inv.amount,
    }).where(eq(invoices.invoiceId, inv.invoiceId))
  }
  return NextResponse.json({ ok: true, reset: tenantInvoices.length })
}
