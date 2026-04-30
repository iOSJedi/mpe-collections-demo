import { NextRequest, NextResponse } from 'next/server'
import admin from 'firebase-admin'
import { verifyExternalLinkToken } from '@/lib/external-link/jwt'
import { stripe } from '@/lib/stripe'
import { getRtdb } from '@/lib/firebase-admin'

// POST /api/external/payment-link/confirm
// Open endpoint — verifies the token + Stripe success, then writes to
// Firebase RTDB at collections/external_payments/{autoId}.
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { token, paymentIntentId, payerEmail, payerName } = body

    if (typeof token !== 'string' || !token) {
      return NextResponse.json({ error: 'token is required' }, { status: 400 })
    }
    if (typeof paymentIntentId !== 'string' || !paymentIntentId) {
      return NextResponse.json({ error: 'paymentIntentId is required' }, { status: 400 })
    }

    let payload
    try {
      payload = verifyExternalLinkToken(token)
    } catch {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 })
    }

    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId)
    if (paymentIntent.status !== 'succeeded') {
      return NextResponse.json(
        { error: `Payment not succeeded. Status: ${paymentIntent.status}` },
        { status: 400 }
      )
    }

    const rtdb = getRtdb()
    if (!rtdb) {
      return NextResponse.json(
        { error: 'Firebase RTDB is not configured on the server' },
        { status: 500 }
      )
    }

    type ExternalPaymentRecord = {
      createdAt: object
      amount: number
      currency: string
      invoiceNumber: string
      customerName: string
      stripePaymentIntentId: string
      status: string
      source: string
      dueDate?: string
      payerEmail?: string
      payerName?: string
      sessionId?: string
    }

    const record: ExternalPaymentRecord = {
      createdAt: admin.database.ServerValue.TIMESTAMP,
      amount: payload.amt,
      currency: 'PHP',
      invoiceNumber: payload.inv,
      customerName: payload.name,
      stripePaymentIntentId: paymentIntent.id,
      status: 'CONFIRMED',
      source: 'EXTERNAL_LINK',
    }
    if (payload.due) record.dueDate = payload.due
    const effectiveEmail =
      typeof payerEmail === 'string' && payerEmail.trim() ? payerEmail.trim() : payload.email
    if (effectiveEmail) record.payerEmail = effectiveEmail
    const effectiveName =
      typeof payerName === 'string' && payerName.trim() ? payerName.trim() : payload.name
    if (effectiveName) record.payerName = effectiveName
    if (payload.sid) record.sessionId = payload.sid

    const ref = await rtdb.ref('collections/external_payments').push(record)

    if (payload.cb) {
      const callbackBody = {
        status: 'succeeded' as const,
        invoiceNumber: payload.inv,
        amount: payload.amt,
        currency: 'PHP',
        paymentIntentId: paymentIntent.id,
        paymentId: ref.key,
        payerEmail: effectiveEmail || undefined,
        payerName: effectiveName || undefined,
        sessionId: payload.sid || undefined,
        timestamp: new Date().toISOString(),
      }
      fetch(payload.cb, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'ayala-land-payment-link/1.0',
        },
        body: JSON.stringify(callbackBody),
      }).catch((err) => {
        console.error('External pay callback (success) failed:', err)
      })
    }

    return NextResponse.json({
      success: true,
      paymentId: ref.key,
    })
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error)
    console.error('Failed to confirm external payment:', errMsg)
    return NextResponse.json(
      { error: `Failed to confirm payment: ${errMsg}` },
      { status: 500 }
    )
  }
}
