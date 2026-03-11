import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { invoices, customers } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { verifyQrToken } from '@/lib/jwt'
import { createPaymentIntent } from '@/lib/stripe'

// POST /api/pay — Create a Stripe PaymentIntent
// Body: { token: string, amount: number }
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { token, amount } = body

    if (!token) {
      return NextResponse.json({ error: 'token is required' }, { status: 400 })
    }
    if (!amount || typeof amount !== 'number' || amount <= 0) {
      return NextResponse.json({ error: 'amount must be a positive number' }, { status: 400 })
    }

    // 1. Verify the QR JWT token
    let payload
    try {
      payload = verifyQrToken(token)
    } catch {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 })
    }

    // 2. Look up the invoice from DB to re-validate amount
    const result = await db
      .select({
        invoiceId: invoices.invoiceId,
        invoiceNumber: invoices.invoiceNumber,
        balanceRemaining: invoices.balanceRemaining,
        customerId: invoices.customerId,
        customerName: customers.name,
      })
      .from(invoices)
      .innerJoin(customers, eq(invoices.customerId, customers.customerId))
      .where(eq(invoices.invoiceNumber, payload.inv))
      .limit(1)

    if (!result.length) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }

    const invoice = result[0]
    const balanceRemaining = Number(invoice.balanceRemaining)

    // Validate amount does not exceed balance
    if (amount > balanceRemaining) {
      return NextResponse.json(
        { error: `Amount (${amount}) exceeds balance remaining (${balanceRemaining})` },
        { status: 400 }
      )
    }

    // 3. Create Stripe PaymentIntent (amount in centavos)
    const paymentIntent = await createPaymentIntent(Math.round(amount * 100), {
      invoice_number: invoice.invoiceNumber,
      customer_name: invoice.customerName,
    })

    // 4. Return clientSecret and paymentIntentId
    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
    })
  } catch (error) {
    console.error('Failed to create PaymentIntent:', error)
    return NextResponse.json({ error: 'Failed to create PaymentIntent' }, { status: 500 })
  }
}
