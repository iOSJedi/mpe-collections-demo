import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { invoices, incomingPayments, penaltyConfig, penaltyLedger, paymentAllocations, creditLedger } from '@/db/schema'
import { eq, sql } from 'drizzle-orm'
import { stripe } from '@/lib/stripe'
import { calculateAllocation } from '@/lib/payment-allocation'
import { addBusinessDays } from '@/lib/utils'
import { invalidateCache } from '@/lib/cache'
import { tryAutoIssueForPayment } from '@/lib/cwt/issue'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { paymentIntentId, invoiceId, customerId, amount, paymentMethod = 'CARD', checkNumber } = body

    if (paymentMethod !== 'CHECK') {
      if (!paymentIntentId) {
        return NextResponse.json({ error: 'paymentIntentId is required for card payments' }, { status: 400 })
      }
      const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId)
      if (paymentIntent.status !== 'succeeded') {
        return NextResponse.json(
          { error: `Payment not succeeded. Status: ${paymentIntent.status}` },
          { status: 400 }
        )
      }
    }

    if (!amount || typeof amount !== 'number' || amount <= 0) {
      return NextResponse.json({ error: 'amount must be a positive number' }, { status: 400 })
    }

    // Determine customerId from invoiceId if not provided
    let cid = customerId
    if (!cid && invoiceId) {
      const invRow = await db.select({ customerId: invoices.customerId }).from(invoices).where(eq(invoices.invoiceId, invoiceId)).limit(1)
      cid = invRow[0]?.customerId
    }
    if (!cid) {
      return NextResponse.json({ error: 'Could not determine customer' }, { status: 400 })
    }

    // CHECK payment — create as PENDING_CLEARANCE and return early (no allocation yet)
    if (paymentMethod === 'CHECK') {
      const clearanceDate = addBusinessDays(new Date(), 3)
      const [payment] = await db.insert(incomingPayments).values({
        invoiceId: invoiceId || null,
        customerId: cid,
        amount: String(amount),
        paymentMethod: 'CHECK',
        checkNumber: checkNumber || null,
        clearanceDate: clearanceDate.toISOString().split('T')[0],
        status: 'PENDING_CLEARANCE',
      }).returning()
      try { await tryAutoIssueForPayment(payment.paymentId) } catch { /* auto-issue failure must not block payment */ }
      invalidateCache('customer-')
      invalidateCache('payments-list')
      return NextResponse.json({
        success: true,
        paymentId: payment.paymentId,
        status: 'PENDING_CLEARANCE',
        clearanceDate: clearanceDate.toISOString().split('T')[0],
      })
    }

    // Load config
    const configRows = await db.select().from(penaltyConfig).limit(1)
    const config = configRows[0]
    const method = (config?.applicationMethod || 'PENALTIES_FIRST') as 'PENALTIES_FIRST' | 'FIFO'
    const penaltyRate = Number(config?.penaltyRatePercent || 2)

    // Load outstanding invoices
    const invoiceRows = await db.select().from(invoices)
      .where(sql`${invoices.customerId} = ${cid} AND ${invoices.status} != 'PAID'`)
      .orderBy(invoices.dueDate)

    // Load penalties
    const invIds = invoiceRows.map(i => i.invoiceId)
    const penaltyRows = invIds.length > 0
      ? await db.select().from(penaltyLedger)
          .where(sql`${penaltyLedger.invoiceId} IN (${sql.join(invIds.map(id => sql`${id}`), sql`, `)}) AND ${penaltyLedger.status} = 'ACTIVE'`)
      : []

    const penMap = new Map<number, typeof penaltyRows>()
    for (const p of penaltyRows) {
      const arr = penMap.get(p.invoiceId) || []
      arr.push(p)
      penMap.set(p.invoiceId, arr)
    }

    const invoicesForCalc = invoiceRows.map(inv => ({
      invoiceId: inv.invoiceId,
      invoiceNumber: inv.invoiceNumber,
      balanceRemaining: Number(inv.balanceRemaining),
      dueDate: inv.dueDate,
      penalties: (penMap.get(inv.invoiceId) || []).map(p => ({
        penaltyId: p.penaltyId,
        periodLabel: p.periodLabel,
        amount: Number(p.penaltyAmount),
        paidAmount: Number(p.paidAmount),
        status: p.status,
      })),
    }))

    const allocation = calculateAllocation(invoicesForCalc, amount, method, penaltyRate)

    // Create payment record (invoiceId null for multi-invoice allocation)
    const [payment] = await db.insert(incomingPayments).values({
      invoiceId: invoiceId || null,
      customerId: cid,
      amount: String(amount),
      paymentMethod: 'CARD',
      stripePaymentIntentId: paymentIntentId,
      status: 'CONFIRMED',
      confirmedAt: new Date(),
    }).returning()
    try { await tryAutoIssueForPayment(payment.paymentId) } catch { /* auto-issue failure must not block payment */ }

    // Write allocation rows
    for (const a of allocation.applied) {
      await db.insert(paymentAllocations).values({
        paymentId: payment.paymentId,
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
      const pen = penaltyRows.find(p => p.penaltyId === penId)
      if (pen) {
        const newPaid = Number(pen.paidAmount) + addedAmount
        const newStatus = newPaid >= Number(pen.penaltyAmount) ? 'PAID' : 'ACTIVE'
        await db.update(penaltyLedger)
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
        penaltiesPaidByInvoice.set(a.invoiceId, (penaltiesPaidByInvoice.get(a.invoiceId) || 0) + a.amount)
      }
    }

    for (const inv of invoiceRows) {
      const principalPaid = principalByInvoice.get(inv.invoiceId) || 0
      const penPaid = penaltiesPaidByInvoice.get(inv.invoiceId) || 0
      if (principalPaid > 0 || penPaid > 0) {
        const newBalance = Math.max(0, Number(inv.balanceRemaining) - principalPaid)
        const newPenPaid = Number(inv.penaltiesPaid) + penPaid
        const newStatus = newBalance <= 0 ? 'PAID' : 'PARTIAL'
        await db.update(invoices)
          .set({
            balanceRemaining: String(newBalance),
            penaltiesPaid: String(newPenPaid),
            status: newStatus,
          })
          .where(eq(invoices.invoiceId, inv.invoiceId))
      }
    }

    // Check for overpayment — create credit ledger entry
    let creditCreated = null
    if (allocation.excessAmount > 0) {
      await db.insert(creditLedger).values({
        customerId: cid,
        type: 'CREDIT',
        amount: String(allocation.excessAmount),
        description: `Overpayment — ₱${allocation.excessAmount.toFixed(2)} excess`,
        paymentId: payment.paymentId,
      })
      await db.execute(
        sql`UPDATE customers_col SET credit_balance = credit_balance + ${allocation.excessAmount} WHERE customer_id = ${cid}`
      )
      creditCreated = { amount: allocation.excessAmount }
    }

    invalidateCache('customer-')
    invalidateCache('payments-list')
    return NextResponse.json({
      success: true,
      paymentId: payment.paymentId,
      allocation: allocation,
      creditCreated,
    })
  } catch (error) {
    console.error('Failed to confirm payment:', error)
    return NextResponse.json({ error: 'Failed to confirm payment' }, { status: 500 })
  }
}
