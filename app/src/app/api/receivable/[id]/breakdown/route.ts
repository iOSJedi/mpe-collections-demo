import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth-middleware'
import { db } from '@/db'
import { customers, invoices, contracts, penaltyLedger, incomingPayments, paymentAllocations } from '@/db/schema'
import { eq, desc, sql } from 'drizzle-orm'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await verifyToken(request)
  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  const { id } = await params
  const customerId = parseInt(id, 10)

  // Customer info
  const customerRows = await db.select().from(customers).where(eq(customers.customerId, customerId)).limit(1)
  if (!customerRows.length) {
    return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
  }
  const customer = customerRows[0]

  // Invoices with contract info
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
    .where(eq(invoices.customerId, customerId))
    .orderBy(invoices.dueDate)

  // Penalties for all these invoices
  const invoiceIds = invoiceRows.map(i => i.invoiceId)
  const penaltyRows = invoiceIds.length > 0
    ? await db.select().from(penaltyLedger)
        .where(sql`${penaltyLedger.invoiceId} IN (${sql.join(invoiceIds.map(id => sql`${id}`), sql`, `)})`)
    : []

  // Group penalties by invoiceId
  const penaltiesByInvoice = new Map<number, typeof penaltyRows>()
  for (const p of penaltyRows) {
    const arr = penaltiesByInvoice.get(p.invoiceId) || []
    arr.push(p)
    penaltiesByInvoice.set(p.invoiceId, arr)
  }

  // Payments with allocations
  const paymentRows = await db
    .select()
    .from(incomingPayments)
    .where(eq(incomingPayments.customerId, customerId))
    .orderBy(desc(incomingPayments.paymentDate))
    .limit(20)

  const paymentIds = paymentRows.map(p => p.paymentId)
  const allocationRows = paymentIds.length > 0
    ? await db.select().from(paymentAllocations)
        .where(sql`${paymentAllocations.paymentId} IN (${sql.join(paymentIds.map(id => sql`${id}`), sql`, `)})`)
    : []

  const allocationsByPayment = new Map<number, typeof allocationRows>()
  for (const a of allocationRows) {
    const arr = allocationsByPayment.get(a.paymentId) || []
    arr.push(a)
    allocationsByPayment.set(a.paymentId, arr)
  }

  const now = new Date()
  const invoicesOut = invoiceRows.map(inv => {
    const dueDate = new Date(inv.dueDate)
    const daysOverdue = Math.max(0, Math.floor((now.getTime() - dueDate.getTime()) / (86400000)))
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

  const paymentsOut = paymentRows.map(p => ({
    paymentId: p.paymentId,
    amount: Number(p.amount),
    paymentMethod: p.paymentMethod,
    paymentDate: p.paymentDate?.toISOString() || '',
    referenceNumber: p.referenceNumber,
    checkNumber: p.checkNumber ?? null,
    clearanceDate: p.clearanceDate ? String(p.clearanceDate) : null,
    status: p.status,
    allocations: (allocationsByPayment.get(p.paymentId) || []).map(a => ({
      allocationId: a.allocationId,
      paymentId: a.paymentId,
      invoiceId: a.invoiceId,
      penaltyId: a.penaltyId,
      allocationType: a.allocationType as 'PRINCIPAL' | 'PENALTY',
      amount: Number(a.amount),
    })),
  }))

  const totalPrincipal = invoicesOut.reduce((s, i) => s + i.amount, 0)
  const totalPenalties = invoicesOut.reduce((s, i) => s + i.totalPenalties, 0)
  const totalPaid = paymentsOut.filter(p => p.status === 'CONFIRMED').reduce((s, p) => s + p.amount, 0)

  return NextResponse.json({
    customer: { customerId: customer.customerId, name: customer.name, accountNumber: customer.accountNumber },
    invoices: invoicesOut,
    payments: paymentsOut,
    totals: {
      totalPrincipal,
      totalPenalties,
      totalPaid,
      grandTotalDue: totalPrincipal + totalPenalties - totalPaid,
    },
  })
}
