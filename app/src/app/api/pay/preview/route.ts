import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { invoices, penaltyLedger, penaltyConfig } from '@/db/schema'
import { sql } from 'drizzle-orm'
import { calculateAllocation } from '@/lib/payment-allocation'

// POST /api/pay/preview — Calculate how a payment would be applied (no DB write)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { customerId, amount } = body

    if (!customerId || !amount || amount <= 0) {
      return NextResponse.json({ error: 'customerId and positive amount required' }, { status: 400 })
    }

    // Get penalty config
    const configRows = await db.select().from(penaltyConfig).limit(1)
    const config = configRows[0]
    const method = (config?.applicationMethod || 'PENALTIES_FIRST') as 'PENALTIES_FIRST' | 'FIFO'
    const penaltyRate = Number(config?.penaltyRatePercent || 2)

    // Get outstanding invoices for this customer
    const invoiceRows = await db
      .select({
        invoiceId: invoices.invoiceId,
        invoiceNumber: invoices.invoiceNumber,
        balanceRemaining: invoices.balanceRemaining,
        dueDate: invoices.dueDate,
      })
      .from(invoices)
      .where(sql`${invoices.customerId} = ${customerId} AND ${invoices.status} != 'PAID'`)
      .orderBy(invoices.dueDate)

    // Get penalties for these invoices
    const invoiceIds = invoiceRows.map(i => i.invoiceId)
    const penaltyRows = invoiceIds.length > 0
      ? await db.select().from(penaltyLedger)
          .where(sql`${penaltyLedger.invoiceId} IN (${sql.join(invoiceIds.map(id => sql`${id}`), sql`, `)}) AND ${penaltyLedger.status} = 'ACTIVE'`)
      : []

    const penaltiesByInvoice = new Map<number, typeof penaltyRows>()
    for (const p of penaltyRows) {
      const arr = penaltiesByInvoice.get(p.invoiceId) || []
      arr.push(p)
      penaltiesByInvoice.set(p.invoiceId, arr)
    }

    const invoicesWithPenalties = invoiceRows.map(inv => ({
      invoiceId: inv.invoiceId,
      invoiceNumber: inv.invoiceNumber,
      balanceRemaining: Number(inv.balanceRemaining),
      dueDate: inv.dueDate,
      penalties: (penaltiesByInvoice.get(inv.invoiceId) || []).map(p => ({
        penaltyId: p.penaltyId,
        periodLabel: p.periodLabel,
        amount: Number(p.penaltyAmount),
        paidAmount: Number(p.paidAmount),
        status: p.status,
      })),
    }))

    const preview = calculateAllocation(invoicesWithPenalties, amount, method, penaltyRate)

    return NextResponse.json(preview)
  } catch (error) {
    console.error('Preview failed:', error)
    return NextResponse.json({ error: 'Preview calculation failed' }, { status: 500 })
  }
}
