import { NextRequest, NextResponse } from 'next/server'
import { verifyExternalLinkToken } from '@/lib/external-link/jwt'

// POST /api/external/payment-link/verify
// Open endpoint — decodes a signed payment-link token and returns the params for the page to render.
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { token } = body

    if (typeof token !== 'string' || !token) {
      return NextResponse.json({ error: 'token is required' }, { status: 400 })
    }

    let payload
    try {
      payload = verifyExternalLinkToken(token)
    } catch {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 })
    }

    return NextResponse.json({
      amount: payload.amt,
      invoiceNumber: payload.inv,
      customerName: payload.name,
      dueDate: payload.due,
      payerEmail: payload.email,
      sessionId: payload.sid,
      callbackUrl: payload.cb,
      expiresAt: new Date(payload.exp).toISOString(),
    })
  } catch (error) {
    console.error('Failed to verify external payment-link token:', error)
    return NextResponse.json({ error: 'Failed to verify token' }, { status: 500 })
  }
}
