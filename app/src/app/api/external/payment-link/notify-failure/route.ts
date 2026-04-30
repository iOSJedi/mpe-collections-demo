import { NextRequest, NextResponse } from 'next/server'
import { verifyExternalLinkToken } from '@/lib/external-link/jwt'

// POST /api/external/payment-link/notify-failure
// Open endpoint — verifies the token and fire-and-forgets a "failed" POST
// to the chatbot's callbackUrl (if present in the token).
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { token, errorMessage } = body

    if (typeof token !== 'string' || !token) {
      return NextResponse.json({ error: 'token is required' }, { status: 400 })
    }

    let payload
    try {
      payload = verifyExternalLinkToken(token)
    } catch {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 })
    }

    if (!payload.cb) {
      return NextResponse.json({ ok: true, dispatched: false })
    }

    const callbackBody = {
      status: 'failed' as const,
      invoiceNumber: payload.inv,
      amount: payload.amt,
      currency: 'PHP',
      errorMessage:
        typeof errorMessage === 'string' && errorMessage.trim()
          ? errorMessage.trim()
          : 'Payment failed.',
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
      console.error('External pay callback (failure) failed:', err)
    })

    return NextResponse.json({ ok: true, dispatched: true })
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error)
    console.error('Failed to dispatch failure callback:', errMsg)
    return NextResponse.json(
      { error: `Failed to dispatch failure callback: ${errMsg}` },
      { status: 500 }
    )
  }
}
