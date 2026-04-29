import { NextRequest, NextResponse } from 'next/server'
import { verifyExternalLinkToken } from '@/lib/external-link/jwt'
import { stripe } from '@/lib/stripe'

// POST /api/external/payment-link/intent
// Open endpoint — verifies the token and creates a Stripe PaymentIntent.
// Amount comes from the signed token, NOT from the request body.
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { token, payerEmail } = body

    if (typeof token !== 'string' || !token) {
      return NextResponse.json({ error: 'token is required' }, { status: 400 })
    }

    let payload
    try {
      payload = verifyExternalLinkToken(token)
    } catch {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 })
    }

    const effectiveEmail =
      typeof payerEmail === 'string' && payerEmail.trim() ? payerEmail.trim() : payload.email

    const metadata: Record<string, string> = {
      source: 'EXTERNAL_LINK',
      invoice_number: payload.inv,
      customer_name: payload.name,
    }
    if (payload.sid) metadata.session_id = payload.sid
    if (effectiveEmail) metadata.payer_email = effectiveEmail

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(payload.amt * 100),
      currency: 'php',
      metadata,
      ...(effectiveEmail ? { receipt_email: effectiveEmail } : {}),
    })

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
    })
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error)
    console.error('Failed to create external PaymentIntent:', errMsg)
    return NextResponse.json(
      { error: `Failed to create PaymentIntent: ${errMsg}` },
      { status: 500 }
    )
  }
}
