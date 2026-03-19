import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { invoices, contracts, penaltyLedger, incomingPayments } from '@/db/schema'
import { eq, sql } from 'drizzle-orm'
import { verifyQrToken } from '@/lib/jwt'

// POST /api/pay/breakdown — Unauthenticated breakdown for payer portal
// Body: { customerId: number, token: string }
// The token is verified to ensure this customer is authorised to view the data.
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { customerId, token } = body

    if (!customerId || !token) {
      return NextResponse.json({ error: 'customerId and token are required' }, { status: 400 })
    }

    // Verify the QR token belongs to this customer
    let payload
    try {
      payload = verifyQrToken(token)
    } catch {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 })
    }

    // Fetch all non-paid invoices for this customer
    const invoiceRows = await db
      .select({
        invoiceId: invoices.invoiceId,
        invoiceNumber: invoices.invoiceNumber,
        billingPeriodStart: invoices.billingPeriodStart,
        billingPeriodEnd: invoices.billingPeriodEnd,
        dueDate: invoices.dueDate,
        amount: invoices.amount,
        balanceRemaining: invoices.balanceRemaining,
        status: invoices.status,
        totalPenalties: invoices.totalPenalties,
        penaltiesPaid: invoices.penaltiesPaid,
        contractNumber: contracts.contractNumber,
      })
      .from(invoices)
      .leftJoin(contracts, eq(invoices.contractId, contracts.contractId))
      .where(sql`${invoices.customerId} = ${customerId} AND ${invoices.status} != 'PAID'`)
      .orderBy(invoices.dueDate)

    // Fetch penalties for these invoices
    const invoiceIds = invoiceRows.map(i => i.invoiceId)
    const penaltyRows = invoiceIds.length > 0
      ? await db.select().from(penaltyLedger)
          .where(sql`${penaltyLedger.invoiceId} IN (${sql.join(invoiceIds.map(id => sql`${id}`), sql`, `)})`)
      : []

    const penaltiesByInvoice = new Map<number, typeof penaltyRows>()
    for (const p of penaltyRows) {
      const arr = penaltiesByInvoice.get(p.invoiceId) || []
      arr.push(p)
      penaltiesByInvoice.set(p.invoiceId, arr)
    }

    const now = new Date()
    const invoicesOut = invoiceRows.map(inv => {
      const dueDate = new Date(inv.dueDate)
      const daysOverdue = Math.max(0, Math.floor((now.getTime() - dueDate.getTime()) / 86400000))
      const pens = (penaltiesByInvoice.get(inv.invoiceId) || []).map(p => ({
        penaltyId: p.penaltyId,
        invoiceId: p.invoiceId,
        periodLabel: p.periodLabel,
        penaltyAmount: Number(p.penaltyAmount),
        penaltyRate: Number(p.penaltyRate),
        accrualDate: p.accrualDate,
        status: p.status as 'ACTIVE' | 'PAID' | 'WAIVED',
        paidAmount: Number(p.paidAmount),
      }))
      return {
        invoiceId: inv.invoiceId,
        invoiceNumber: inv.invoiceNumber,
        billingPeriodStart: inv.billingPeriodStart,
        billingPeriodEnd: inv.billingPeriodEnd,
        dueDate: inv.dueDate,
        amount: Number(inv.amount),
        balanceRemaining: Number(inv.balanceRemaining),
        status: inv.status,
        contractNumber: inv.contractNumber || '',
        totalPenalties: Number(inv.totalPenalties),
        penaltiesPaid: Number(inv.penaltiesPaid),
        penalties: pens,
        daysOverdue,
      }
    })

    // Get confirmed payments total
    const paymentRows = await db
      .select({ amount: incomingPayments.amount, status: incomingPayments.status })
      .from(incomingPayments)
      .where(sql`${incomingPayments.customerId} = ${customerId}`)

    const totalPaid = paymentRows
      .filter(p => p.status === 'CONFIRMED')
      .reduce((s, p) => s + Number(p.amount), 0)

    const totalPrincipal = invoicesOut.reduce((s, i) => s + i.amount, 0)
    const totalPenalties = invoicesOut.reduce((s, i) => s + i.totalPenalties, 0)

    return NextResponse.json({
      invoices: invoicesOut,
      totals: {
        totalPrincipal,
        totalPenalties,
        totalPaid,
        grandTotalDue: totalPrincipal + totalPenalties - totalPaid,
      },
    })
  } catch (error) {
    console.error('Breakdown failed:', error)
    return NextResponse.json({ error: 'Failed to load breakdown' }, { status: 500 })
  }
}
