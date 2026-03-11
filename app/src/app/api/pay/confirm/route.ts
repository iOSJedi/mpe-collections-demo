import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { invoices, incomingPayments } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { stripe } from '@/lib/stripe'

// POST /api/pay/confirm — Confirm a successful Stripe payment and record it
// Body: { paymentIntentId: string, invoiceId: number, amount: number }
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { paymentIntentId, invoiceId, amount } = body

    if (!paymentIntentId) {
      return NextResponse.json({ error: 'paymentIntentId is required' }, { status: 400 })
    }
    if (!invoiceId || typeof invoiceId !== 'number') {
      return NextResponse.json({ error: 'invoiceId must be a number' }, { status: 400 })
    }
    if (!amount || typeof amount !== 'number' || amount <= 0) {
      return NextResponse.json({ error: 'amount must be a positive number' }, { status: 400 })
    }

    // 1. Verify the PaymentIntent succeeded with Stripe
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId)
    if (paymentIntent.status !== 'succeeded') {
      return NextResponse.json(
        { error: `Payment not succeeded. Status: ${paymentIntent.status}` },
        { status: 400 }
      )
    }

    // 2. Look up the invoice to get customerId and current balance
    const invoiceResult = await db
      .select({
        invoiceId: invoices.invoiceId,
        customerId: invoices.customerId,
        balanceRemaining: invoices.balanceRemaining,
      })
      .from(invoices)
      .where(eq(invoices.invoiceId, invoiceId))
      .limit(1)

    if (!invoiceResult.length) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }

    const invoice = invoiceResult[0]
    const currentBalance = Number(invoice.balanceRemaining)
    const newBalance = Math.max(0, currentBalance - amount)
    const newStatus = newBalance <= 0 ? 'PAID' : 'PARTIAL'

    // 3. Create incoming payment record
    const [payment] = await db
      .insert(incomingPayments)
      .values({
        invoiceId: invoice.invoiceId,
        customerId: invoice.customerId,
        amount: String(amount),
        paymentMethod: 'CARD',
        stripePaymentIntentId: paymentIntentId,
        status: 'CONFIRMED',
        confirmedAt: new Date(),
      })
      .returning()

    // 4. Update invoice balance and status
    await db
      .update(invoices)
      .set({
        balanceRemaining: String(newBalance),
        status: newStatus,
      })
      .where(eq(invoices.invoiceId, invoiceId))

    return NextResponse.json({
      success: true,
      paymentId: payment.paymentId,
      newBalance,
    })
  } catch (error) {
    console.error('Failed to confirm payment:', error)
    return NextResponse.json({ error: 'Failed to confirm payment' }, { status: 500 })
  }
}
