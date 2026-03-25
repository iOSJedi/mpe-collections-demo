import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth-middleware'
import { db } from '@/db'
import { sql } from 'drizzle-orm'
import { incomingPayments, invoices, penaltyConfig, penaltyLedger, paymentAllocations } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { calculateAllocation } from '@/lib/payment-allocation'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await verifyToken(request)
  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  try {
    const { id } = await params
    const paymentId = parseInt(id, 10)
    if (isNaN(paymentId)) {
      return NextResponse.json({ error: 'Invalid payment ID' }, { status: 400 })
    }

    const body = await request.json()
    const { action } = body as { action: 'confirm' | 'bounce' }

    if (action !== 'confirm' && action !== 'bounce') {
      return NextResponse.json({ error: 'action must be "confirm" or "bounce"' }, { status: 400 })
    }

    // Load the payment
    const [payment] = await db
      .select()
      .from(incomingPayments)
      .where(eq(incomingPayments.paymentId, paymentId))
      .limit(1)

    if (!payment) {
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 })
    }

    // Handle bounce
    if (action === 'bounce') {
      await db
        .update(incomingPayments)
        .set({ status: 'BOUNCED' })
        .where(eq(incomingPayments.paymentId, paymentId))

      return NextResponse.json({ success: true, status: 'BOUNCED' })
    }

    // Handle confirm — must be PENDING_CLEARANCE
    if (payment.status !== 'PENDING_CLEARANCE') {
      return NextResponse.json(
        { error: `Payment status is "${payment.status}", expected PENDING_CLEARANCE` },
        { status: 400 }
      )
    }

    const cid = payment.customerId
    const amount = Number(payment.amount)

    // Load penalty config
    const configRows = await db.select().from(penaltyConfig).limit(1)
    const config = configRows[0]
    const method = (config?.applicationMethod || 'PENALTIES_FIRST') as 'PENALTIES_FIRST' | 'FIFO'
    const penaltyRate = Number(config?.penaltyRatePercent || 2)

    // Load outstanding invoices for the customer
    const invoiceRows = await db
      .select()
      .from(invoices)
      .where(sql`${invoices.customerId} = ${cid} AND ${invoices.status} != 'PAID'`)
      .orderBy(invoices.dueDate)

    // Load penalties for those invoices
    const invIds = invoiceRows.map((i) => i.invoiceId)
    const penaltyRows =
      invIds.length > 0
        ? await db
            .select()
            .from(penaltyLedger)
            .where(
              sql`${penaltyLedger.invoiceId} IN (${sql.join(
                invIds.map((id) => sql`${id}`),
                sql`, `
              )}) AND ${penaltyLedger.status} = 'ACTIVE'`
            )
        : []

    const penMap = new Map<number, typeof penaltyRows>()
    for (const p of penaltyRows) {
      const arr = penMap.get(p.invoiceId) || []
      arr.push(p)
      penMap.set(p.invoiceId, arr)
    }

    const invoicesForCalc = invoiceRows.map((inv) => ({
      invoiceId: inv.invoiceId,
      invoiceNumber: inv.invoiceNumber,
      balanceRemaining: Number(inv.balanceRemaining),
      dueDate: inv.dueDate,
      penalties: (penMap.get(inv.invoiceId) || []).map((p) => ({
        penaltyId: p.penaltyId,
        periodLabel: p.periodLabel,
        amount: Number(p.penaltyAmount),
        paidAmount: Number(p.paidAmount),
        status: p.status,
      })),
    }))

    const allocation = calculateAllocation(invoicesForCalc, amount, method, penaltyRate)

    // Mark payment as CONFIRMED
    await db
      .update(incomingPayments)
      .set({ status: 'CONFIRMED', confirmedAt: new Date() })
      .where(eq(incomingPayments.paymentId, paymentId))

    // Write allocation rows
    for (const a of allocation.applied) {
      await db.insert(paymentAllocations).values({
        paymentId: paymentId,
        invoiceId: a.invoiceId,
        penaltyId: a.penaltyId || null,
        allocationType: a.allocationType,
        amount: String(a.amount),
      })
    }

    // Update penalty ledger entries
    const penaltyUpdates = new Map<number, number>()
    for (const a of allocation.applied) {
      if (a.allocationType === 'PENALTY' && a.penaltyId) {
        penaltyUpdates.set(a.penaltyId, (penaltyUpdates.get(a.penaltyId) || 0) + a.amount)
      }
    }
    for (const [penId, addedAmount] of penaltyUpdates) {
      const pen = penaltyRows.find((p) => p.penaltyId === penId)
      if (pen) {
        const newPaid = Number(pen.paidAmount) + addedAmount
        const newStatus = newPaid >= Number(pen.penaltyAmount) ? 'PAID' : 'ACTIVE'
        await db
          .update(penaltyLedger)
          .set({ paidAmount: String(newPaid), status: newStatus, updatedAt: new Date() })
          .where(eq(penaltyLedger.penaltyId, penId))
      }
    }

    // Update invoice balances
    const principalByInvoice = new Map<number, number>()
    for (const a of allocation.applied) {
      if (a.allocationType === 'PRINCIPAL') {
        principalByInvoice.set(a.invoiceId, (principalByInvoice.get(a.invoiceId) || 0) + a.amount)
      }
    }
    const penaltiesPaidByInvoice = new Map<number, number>()
    for (const a of allocation.applied) {
      if (a.allocationType === 'PENALTY') {
        penaltiesPaidByInvoice.set(
          a.invoiceId,
          (penaltiesPaidByInvoice.get(a.invoiceId) || 0) + a.amount
        )
      }
    }

    for (const inv of invoiceRows) {
      const principalPaid = principalByInvoice.get(inv.invoiceId) || 0
      const penPaid = penaltiesPaidByInvoice.get(inv.invoiceId) || 0
      if (principalPaid > 0 || penPaid > 0) {
        const newBalance = Math.max(0, Number(inv.balanceRemaining) - principalPaid)
        const newPenPaid = Number(inv.penaltiesPaid) + penPaid
        const newStatus = newBalance <= 0 ? 'PAID' : 'PARTIAL'
        await db
          .update(invoices)
          .set({
            balanceRemaining: String(newBalance),
            penaltiesPaid: String(newPenPaid),
            status: newStatus,
          })
          .where(eq(invoices.invoiceId, inv.invoiceId))
      }
    }

    return NextResponse.json({
      success: true,
      status: 'CONFIRMED',
      allocation,
    })
  } catch (error) {
    console.error('Failed to process check action:', error)
    return NextResponse.json({ error: 'Failed to process check action' }, { status: 500 })
  }
}
