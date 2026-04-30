import { NextRequest, NextResponse } from 'next/server'
import { signExternalLinkToken } from '@/lib/external-link/jwt'
import { ExternalPayLinkPayload } from '@/types'

// POST /api/external/payment-link
// Open endpoint (no auth) — mints a signed payment URL for chatbot-driven flows.
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      amount,
      invoiceNumber,
      customerName,
      dueDate,
      payerEmail,
      sessionId,
      callbackUrl,
    } = body

    if (typeof amount !== 'number' || !(amount > 0)) {
      return NextResponse.json(
        { error: 'amount must be a positive number' },
        { status: 400 }
      )
    }
    if (typeof invoiceNumber !== 'string' || !invoiceNumber.trim()) {
      return NextResponse.json(
        { error: 'invoiceNumber is required' },
        { status: 400 }
      )
    }
    if (typeof customerName !== 'string' || !customerName.trim()) {
      return NextResponse.json(
        { error: 'customerName is required' },
        { status: 400 }
      )
    }

    let validCallbackUrl: string | undefined
    if (typeof callbackUrl === 'string' && callbackUrl.trim()) {
      try {
        const parsed = new URL(callbackUrl.trim())
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
          return NextResponse.json(
            { error: 'callbackUrl must use http or https' },
            { status: 400 }
          )
        }
        validCallbackUrl = parsed.toString()
      } catch {
        return NextResponse.json(
          { error: 'callbackUrl is not a valid URL' },
          { status: 400 }
        )
      }
    }

    const exp = Date.now() + 24 * 60 * 60 * 1000

    const payload: ExternalPayLinkPayload = {
      inv: invoiceNumber.trim(),
      name: customerName.trim(),
      amt: amount,
      exp,
    }
    if (typeof dueDate === 'string' && dueDate.trim()) payload.due = dueDate.trim()
    if (typeof payerEmail === 'string' && payerEmail.trim()) payload.email = payerEmail.trim()
    if (typeof sessionId === 'string' && sessionId.trim()) payload.sid = sessionId.trim()
    if (validCallbackUrl) payload.cb = validCallbackUrl

    const token = signExternalLinkToken(payload)

    const url = `${request.nextUrl.origin}/pay/external?token=${token}`

    return NextResponse.json({
      url,
      expiresAt: new Date(exp).toISOString(),
    })
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error)
    console.error('Failed to mint external payment link:', errMsg)
    return NextResponse.json(
      { error: `Failed to mint payment link: ${errMsg}` },
      { status: 500 }
    )
  }
}
