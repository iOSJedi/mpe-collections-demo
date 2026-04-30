# External Pay Reskin + Chatbot Callback Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reskin the public `/pay/external` flow to the Ayala Land Access brand (cream/forest-green palette + "A" logo), drop the chatbot subtitle, and add an optional `callbackUrl` parameter so the calling chatbot is notified by HTTP POST on payment success (server-side) and failure (client-side via a new server endpoint).

**Architecture:** Hex values are inlined in the touched components (matches the existing `/pay` page pattern; no changes to shared `globals.css`). The token type gains an optional `cb` field. The mint endpoint validates the URL and embeds it. The confirm endpoint fires a server-side callback after RTDB push. A new `notify-failure` endpoint accepts a token + error message and forwards to the chatbot. The form calls notify-failure on every error path.

**Tech Stack:** Next.js 16 App Router, React 19, Tailwind CSS, Stripe Elements, jsonwebtoken, Firebase Admin SDK (RTDB).

**Spec:** `docs/superpowers/specs/2026-04-30-external-pay-reskin-callback-design.md`

**Important context:** No test framework is configured in this project. Verification per task is via `npm run lint` from `/home/josef/projects/mpe-collections-demo/app`, plus `curl` for API endpoints and (when relevant) a browser smoke. Match the established pattern from the prior feature branch.

**Branding palette (used across multiple tasks; canonical here):**

| Token              | Hex        |
| ------------------ | ---------- |
| Cream background   | `#F5EEDE`  |
| Forest green       | `#0E2C20`  |
| Warm gray (muted)  | `#383D36`  |
| Warm tan (border)  | `#DDD4C9`  |
| Ember accent       | `#CE3106`  |

---

## Task 1: Add `cb` to token type, copy logo asset

**Files:**
- Modify: `app/src/types/index.ts`
- Create: `app/public/ali-access-logo.svg` (binary copy)

- [ ] **Step 1: Add `cb` to `ExternalPayLinkPayload`**

Open `app/src/types/index.ts` and find the `ExternalPayLinkPayload` interface near the end of the file. Add a new optional `cb` field directly after `sid`:

Current (around lines 472-481):

```ts
export interface ExternalPayLinkPayload {
  inv: string        // invoice_number — chatbot-supplied, arbitrary string
  name: string       // customer_name
  amt: number        // amount (PHP)
  due?: string       // due_date (YYYY-MM-DD), optional
  email?: string     // payer_email, optional
  sid?: string       // session_id from chatbot, optional
  exp: number        // expiry timestamp (ms epoch)
}
```

Replace with:

```ts
export interface ExternalPayLinkPayload {
  inv: string        // invoice_number — chatbot-supplied, arbitrary string
  name: string       // customer_name
  amt: number        // amount (PHP)
  due?: string       // due_date (YYYY-MM-DD), optional
  email?: string     // payer_email, optional
  sid?: string       // session_id from chatbot, optional
  cb?: string        // callback URL — chatbot webhook, optional
  exp: number        // expiry timestamp (ms epoch)
}
```

- [ ] **Step 2: Copy the logo SVG**

Run from `/home/josef/projects/mpe-collections-demo`:

```bash
cp /home/josef/projects/ali-access-chatbot/app/public/logo.svg app/public/ali-access-logo.svg
```

Verify it landed:

```bash
ls -l app/public/ali-access-logo.svg
head -3 app/public/ali-access-logo.svg
```

Expected: file exists, ~639 bytes, starts with `<svg width="180" height="180" ...`.

- [ ] **Step 3: Type-check**

Run from `/home/josef/projects/mpe-collections-demo/app`:

```bash
npm run lint
```

Expected: passes (or reports only pre-existing warnings, no NEW errors).

- [ ] **Step 4: Commit**

```bash
git add app/src/types/index.ts app/public/ali-access-logo.svg
git commit -m "feat(external-pay): add cb token field and ali-access logo asset"
```

---

## Task 2: Mint endpoint accepts and validates `callbackUrl`

**Files:**
- Modify: `app/src/app/api/external/payment-link/route.ts`

- [ ] **Step 1: Add `callbackUrl` validation and embed it**

Open `app/src/app/api/external/payment-link/route.ts`. Locate the validation block and the payload-construction block.

After the existing `customerName` validation (around line 33), add a new validation block. Then in the payload construction, add the `cb` assignment alongside the other optional fields.

Replace the block:

```ts
    if (typeof customerName !== 'string' || !customerName.trim()) {
      return NextResponse.json(
        { error: 'customerName is required' },
        { status: 400 }
      )
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
```

With:

```ts
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
```

Also extend the destructure at the top of the handler. Find:

```ts
    const {
      amount,
      invoiceNumber,
      customerName,
      dueDate,
      payerEmail,
      sessionId,
    } = body
```

Replace with:

```ts
    const {
      amount,
      invoiceNumber,
      customerName,
      dueDate,
      payerEmail,
      sessionId,
      callbackUrl,
    } = body
```

- [ ] **Step 2: Type-check**

```bash
npm run lint
```

Expected: passes (no NEW errors).

- [ ] **Step 3: Manual smoke**

Start dev server:

```bash
cd /home/josef/projects/mpe-collections-demo/app
npm run dev
```

Wait for `Ready in ...`, then in another terminal:

```bash
# Happy path with callbackUrl
curl -s -X POST http://localhost:3000/api/external/payment-link \
  -H "Content-Type: application/json" \
  -d '{"amount":1000,"invoiceNumber":"X1","customerName":"Y","callbackUrl":"https://webhook.site/abc"}' \
  | python3 -m json.tool
```

Expected: 200, returns `url` and `expiresAt`. Decode the JWT payload to verify `cb` is embedded:

```bash
curl -s -X POST http://localhost:3000/api/external/payment-link \
  -H "Content-Type: application/json" \
  -d '{"amount":1000,"invoiceNumber":"X1","customerName":"Y","callbackUrl":"https://webhook.site/abc"}' \
  | python3 -c "import sys,json,base64; t=json.load(sys.stdin)['url'].split('token=')[1].split('.')[1]; t+='='*(-len(t)%4); print(json.dumps(json.loads(base64.urlsafe_b64decode(t)), indent=2))"
```

Expected payload contains `"cb": "https://webhook.site/abc"`.

```bash
# Invalid scheme rejected
curl -s -X POST http://localhost:3000/api/external/payment-link \
  -H "Content-Type: application/json" \
  -d '{"amount":1000,"invoiceNumber":"X1","customerName":"Y","callbackUrl":"javascript:alert(1)"}' \
  -w "\nHTTP %{http_code}\n"
```

Expected: HTTP 400, body `{"error":"callbackUrl must use http or https"}`.

```bash
# Garbage rejected
curl -s -X POST http://localhost:3000/api/external/payment-link \
  -H "Content-Type: application/json" \
  -d '{"amount":1000,"invoiceNumber":"X1","customerName":"Y","callbackUrl":"not a url"}' \
  -w "\nHTTP %{http_code}\n"
```

Expected: HTTP 400, body `{"error":"callbackUrl is not a valid URL"}`.

```bash
# Without callbackUrl still works (omitted from payload)
curl -s -X POST http://localhost:3000/api/external/payment-link \
  -H "Content-Type: application/json" \
  -d '{"amount":1000,"invoiceNumber":"X1","customerName":"Y"}' \
  | python3 -c "import sys,json,base64; t=json.load(sys.stdin)['url'].split('token=')[1].split('.')[1]; t+='='*(-len(t)%4); p=json.loads(base64.urlsafe_b64decode(t)); print('cb present:', 'cb' in p)"
```

Expected output: `cb present: False`.

Stop the dev server (Ctrl+C).

- [ ] **Step 4: Commit**

```bash
git add app/src/app/api/external/payment-link/route.ts
git commit -m "feat(external-pay): accept callbackUrl on mint endpoint"
```

---

## Task 3: Verify endpoint surfaces `callbackUrl`

**Files:**
- Modify: `app/src/app/api/external/payment-link/verify/route.ts`

- [ ] **Step 1: Add `callbackUrl` to the response shape**

Open `app/src/app/api/external/payment-link/verify/route.ts`. Locate the `NextResponse.json({...})` success return. Add `callbackUrl: payload.cb` directly after `sessionId`.

Replace:

```ts
    return NextResponse.json({
      amount: payload.amt,
      invoiceNumber: payload.inv,
      customerName: payload.name,
      dueDate: payload.due,
      payerEmail: payload.email,
      sessionId: payload.sid,
      expiresAt: new Date(payload.exp).toISOString(),
    })
```

With:

```ts
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
```

- [ ] **Step 2: Type-check**

```bash
npm run lint
```

Expected: passes.

- [ ] **Step 3: Manual smoke**

Start dev server (`npm run dev` from `/app`), then:

```bash
TOKEN=$(curl -s -X POST http://localhost:3000/api/external/payment-link \
  -H "Content-Type: application/json" \
  -d '{"amount":1000,"invoiceNumber":"X1","customerName":"Y","callbackUrl":"https://webhook.site/abc"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['url'].split('token=')[1])")

curl -s -X POST http://localhost:3000/api/external/payment-link/verify \
  -H "Content-Type: application/json" \
  -d "{\"token\":\"$TOKEN\"}" | python3 -m json.tool
```

Expected: response includes `"callbackUrl": "https://webhook.site/abc"`.

When minted without `callbackUrl`, the verify response either omits the key or sets it to null — both acceptable.

Stop the dev server.

- [ ] **Step 4: Commit**

```bash
git add app/src/app/api/external/payment-link/verify/route.ts
git commit -m "feat(external-pay): surface callbackUrl on verify endpoint"
```

---

## Task 4: Confirm endpoint fires server-side success callback

**Files:**
- Modify: `app/src/app/api/external/payment-link/confirm/route.ts`

- [ ] **Step 1: Add the fire-and-forget callback after RTDB push**

Open `app/src/app/api/external/payment-link/confirm/route.ts`. Locate the line `const ref = await rtdb.ref('collections/external_payments').push(record)` and the subsequent return.

Replace:

```ts
    const ref = await rtdb.ref('collections/external_payments').push(record)

    return NextResponse.json({
      success: true,
      paymentId: ref.key,
    })
```

With:

```ts
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
```

The `fetch` is intentionally not awaited. Failure of the chatbot's webhook must not affect the user's success response.

- [ ] **Step 2: Type-check**

```bash
npm run lint
```

Expected: passes.

- [ ] **Step 3: Manual smoke deferred**

Exercising this path requires a real Stripe-succeeded PaymentIntent and a webhook collector. Defer until Task 9 end-to-end.

- [ ] **Step 4: Commit**

```bash
git add app/src/app/api/external/payment-link/confirm/route.ts
git commit -m "feat(external-pay): fire success callback after RTDB push"
```

---

## Task 5: New `notify-failure` endpoint

**Files:**
- Create: `app/src/app/api/external/payment-link/notify-failure/route.ts`

- [ ] **Step 1: Create the route**

Create `app/src/app/api/external/payment-link/notify-failure/route.ts` with these exact contents:

```ts
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
```

- [ ] **Step 2: Type-check**

```bash
npm run lint
```

Expected: passes (no NEW errors).

- [ ] **Step 3: Manual smoke**

Start dev server (`npm run dev`), then:

```bash
# Mint a token with a callback URL
TOKEN=$(curl -s -X POST http://localhost:3000/api/external/payment-link \
  -H "Content-Type: application/json" \
  -d '{"amount":1000,"invoiceNumber":"X1","customerName":"Y","callbackUrl":"https://webhook.site/abc"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['url'].split('token=')[1])")

# Dispatch via notify-failure
curl -s -X POST http://localhost:3000/api/external/payment-link/notify-failure \
  -H "Content-Type: application/json" \
  -d "{\"token\":\"$TOKEN\",\"errorMessage\":\"Card declined\"}" | python3 -m json.tool
```

Expected: `{"ok": true, "dispatched": true}`. (The actual webhook delivery is fire-and-forget; check `webhook.site/abc` if you wired a real test URL.)

```bash
# Token without callback returns dispatched:false
TOKEN_NO_CB=$(curl -s -X POST http://localhost:3000/api/external/payment-link \
  -H "Content-Type: application/json" \
  -d '{"amount":1000,"invoiceNumber":"X1","customerName":"Y"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['url'].split('token=')[1])")

curl -s -X POST http://localhost:3000/api/external/payment-link/notify-failure \
  -H "Content-Type: application/json" \
  -d "{\"token\":\"$TOKEN_NO_CB\",\"errorMessage\":\"x\"}" | python3 -m json.tool
```

Expected: `{"ok": true, "dispatched": false}`.

```bash
# Bad token returns 401
curl -s -X POST http://localhost:3000/api/external/payment-link/notify-failure \
  -H "Content-Type: application/json" \
  -d '{"token":"garbage","errorMessage":"x"}' \
  -w "\nHTTP %{http_code}\n"
```

Expected: HTTP 401, body `{"error":"Invalid or expired token"}`.

Stop the dev server.

- [ ] **Step 4: Commit**

```bash
git add app/src/app/api/external/payment-link/notify-failure/route.ts
git commit -m "feat(external-pay): notify-failure endpoint dispatches client-side failures"
```

---

## Task 6: Reskin success page

**Files:**
- Modify: `app/src/app/pay/external/success/page.tsx`

- [ ] **Step 1: Replace the success page contents**

Replace the entire contents of `app/src/app/pay/external/success/page.tsx` with:

```tsx
'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { CheckCircle2, ShieldCheck, Loader2 } from 'lucide-react'

function SuccessPage() {
  const searchParams = useSearchParams()
  const amount = searchParams.get('amount')
  const invoice = searchParams.get('invoice')

  const parsedAmount = amount ? Number(amount) : NaN
  const amountDisplay = Number.isFinite(parsedAmount)
    ? `₱${parsedAmount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}`
    : null

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#F5EEDE' }}>
      <header className="px-6 py-4 shadow-md" style={{ backgroundColor: '#0E2C20' }}>
        <div className="max-w-md mx-auto flex items-center gap-3">
          <img
            src="/ali-access-logo.svg"
            alt="Ayala Land Access"
            className="h-9 w-9 rounded-md bg-white"
          />
          <span className="text-white font-bold text-base tracking-tight">
            Ayala Land Access
          </span>
        </div>
      </header>

      <main className="flex-1 flex items-start justify-center py-8 px-4">
        <div className="w-full max-w-md">
          <div
            className="bg-white rounded-xl shadow-sm overflow-hidden border"
            style={{ borderColor: '#DDD4C9' }}
          >
            <div className="p-8 flex flex-col items-center gap-3 text-center">
              <CheckCircle2 className="h-14 w-14" style={{ color: '#0E2C20' }} />
              <h1 className="text-xl font-semibold" style={{ color: '#0E2C20' }}>
                Payment Successful
              </h1>
              {amountDisplay && (
                <p className="text-2xl font-bold" style={{ color: '#0E2C20' }}>
                  {amountDisplay}
                </p>
              )}
              {invoice && (
                <p className="text-sm" style={{ color: '#383D36' }}>
                  Invoice {invoice}
                </p>
              )}
              <p className="text-sm mt-2" style={{ color: '#383D36' }}>
                Your payment has been processed and confirmed. A receipt has been emailed
                to the address you provided.
              </p>
            </div>
          </div>
        </div>
      </main>

      <footer className="py-4 px-4 text-center">
        <div
          className="flex items-center justify-center gap-2 text-xs"
          style={{ color: '#383D36' }}
        >
          <ShieldCheck className="h-3.5 w-3.5" style={{ color: '#0E2C20' }} />
          <span>Secured by Ayala Land Access</span>
        </div>
      </footer>
    </div>
  )
}

export default function SuccessPageWrapper() {
  return (
    <Suspense
      fallback={
        <div
          className="min-h-screen flex items-center justify-center"
          style={{ backgroundColor: '#F5EEDE' }}
        >
          <Loader2 className="h-8 w-8 animate-spin" style={{ color: '#0E2C20' }} />
        </div>
      }
    >
      <SuccessPage />
    </Suspense>
  )
}
```

- [ ] **Step 2: Type-check**

```bash
npm run lint
```

Expected: passes. The codebase config may flag `<img>` (`@next/next/no-img-element`); if it surfaces as a NEW error here, suppress for this single line by adding `{/* eslint-disable-next-line @next/next/no-img-element */}` directly above the `<img ...>` tag. Otherwise leave as-is.

- [ ] **Step 3: Browser smoke**

Start `npm run dev` and open:

```
http://localhost:3000/pay/external/success?amount=12500&invoice=EXT-2026-001
```

Expected: cream background, forest-green header bar with logo + wordmark, success card with green checkmark, "₱12,500.00", "Invoice EXT-2026-001", and the receipt blurb. Footer reads "Secured by Ayala Land Access". Stop the dev server.

- [ ] **Step 4: Commit**

```bash
git add app/src/app/pay/external/success/page.tsx
git commit -m "feat(external-pay): reskin success page to ali-access brand"
```

---

## Task 7: Reskin `ExternalPaymentForm` and add notify-failure calls

**Files:**
- Modify: `app/src/components/pay/external/ExternalPaymentForm.tsx`

- [ ] **Step 1: Replace the component contents**

Replace the entire contents of `app/src/components/pay/external/ExternalPaymentForm.tsx` with:

```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CardElement, useStripe, useElements } from '@stripe/react-stripe-js'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface ExternalPaymentFormProps {
  clientSecret: string
  token: string
  amount: number
  invoiceNumber: string
  payerEmail: string
  payerName: string
}

const CARD_ELEMENT_OPTIONS = {
  style: {
    base: {
      color: '#0E2C20',
      fontFamily: 'Inter, system-ui, sans-serif',
      fontSize: '16px',
      fontSmoothing: 'antialiased',
      '::placeholder': { color: '#383D36' },
    },
    invalid: { color: '#CE3106', iconColor: '#CE3106' },
  },
  hidePostalCode: false,
}

function notifyFailure(token: string, errorMessage: string) {
  fetch('/api/external/payment-link/notify-failure', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, errorMessage }),
  }).catch(() => {
    // Fire-and-forget; do not surface this to the user.
  })
}

export function ExternalPaymentForm({
  clientSecret,
  token,
  amount,
  invoiceNumber,
  payerEmail,
  payerName,
}: ExternalPaymentFormProps) {
  const stripe = useStripe()
  const elements = useElements()
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handlePay() {
    if (!stripe || !elements) return
    setLoading(true)
    setError(null)

    const cardElement = elements.getElement(CardElement)
    if (!cardElement) {
      setError('Card element not found.')
      setLoading(false)
      return
    }

    const { error: stripeError, paymentIntent } = await stripe.confirmCardPayment(
      clientSecret,
      { payment_method: { card: cardElement, billing_details: { email: payerEmail, name: payerName } } }
    )

    if (stripeError) {
      const msg = stripeError.message ?? 'Payment failed.'
      notifyFailure(token, msg)
      setError(msg)
      setLoading(false)
      return
    }

    if (paymentIntent?.status !== 'succeeded') {
      const msg = `Payment was not completed. Status: ${paymentIntent?.status ?? 'unknown'}`
      notifyFailure(token, msg)
      setError('Payment was not completed. Please try again.')
      setLoading(false)
      return
    }

    try {
      const res = await fetch('/api/external/payment-link/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          paymentIntentId: paymentIntent.id,
          payerEmail,
          payerName,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        const msg = data.error ?? 'Failed to record payment.'
        notifyFailure(token, msg)
        setError(msg)
        setLoading(false)
        return
      }

      const params = new URLSearchParams({
        amount: String(amount),
        invoice: invoiceNumber,
      })
      router.push(`/pay/external/success?${params.toString()}`)
    } catch {
      const msg = 'Failed to record payment. Please contact support.'
      notifyFailure(token, msg)
      setError(msg)
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <div
        className="rounded-lg border bg-white p-4"
        style={{ borderColor: '#DDD4C9' }}
      >
        <CardElement options={CARD_ELEMENT_OPTIONS} />
      </div>

      {error && (
        <p
          className="text-sm rounded-md px-3 py-2 border"
          style={{ color: '#CE3106', borderColor: '#CE3106', backgroundColor: '#FEEFEA' }}
        >
          {error}
        </p>
      )}

      <Button
        onClick={handlePay}
        disabled={!stripe || loading}
        className="w-full text-white hover:opacity-90"
        style={{ backgroundColor: '#0E2C20' }}
        size="lg"
      >
        {loading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Processing...
          </>
        ) : (
          `Pay ₱${amount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
        )}
      </Button>

      <p className="text-xs text-center" style={{ color: '#383D36' }}>
        Secured by Stripe. Card details are never stored on our servers.
      </p>
    </div>
  )
}
```

- [ ] **Step 2: Type-check**

```bash
npm run lint
```

Expected: passes (no NEW errors).

- [ ] **Step 3: Commit**

```bash
git add app/src/components/pay/external/ExternalPaymentForm.tsx
git commit -m "feat(external-pay): reskin form to ali-access brand and notify on failure"
```

(Browser smoke happens in Task 9 end-to-end.)

---

## Task 8: Reskin main `/pay/external` page and drop subtitle

**Files:**
- Modify: `app/src/app/pay/external/page.tsx`

- [ ] **Step 1: Replace the page contents**

Replace the entire contents of `app/src/app/pay/external/page.tsx` with:

```tsx
'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { Elements } from '@stripe/react-stripe-js'
import { loadStripe, Appearance, Stripe } from '@stripe/stripe-js'
import { Loader2, ShieldCheck } from 'lucide-react'
import { ExternalPaymentForm } from '@/components/pay/external/ExternalPaymentForm'

interface VerifiedTokenData {
  amount: number
  invoiceNumber: string
  customerName: string
  dueDate?: string
  payerEmail?: string
  sessionId?: string
  callbackUrl?: string
  expiresAt: string
}

const appearance: Appearance = {
  theme: 'flat',
  variables: {
    colorPrimary: '#0E2C20',
    colorBackground: '#ffffff',
    fontFamily: 'Inter, system-ui, sans-serif',
  },
  rules: { '.Label': { color: '#383D36' } },
}

function defaultEmail(sessionId: string | undefined): string {
  if (sessionId && sessionId.trim()) {
    return `chatbot-${sessionId.trim()}@demo.local`
  }
  const rand = Math.random().toString(36).slice(2, 10)
  return `chatbot-${rand}@demo.local`
}

function ExternalPayPage() {
  const searchParams = useSearchParams()
  const token = searchParams.get('token')

  const [stripePromise, setStripePromise] = useState<Promise<Stripe | null> | null>(null)
  const [verified, setVerified] = useState<VerifiedTokenData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [payerEmail, setPayerEmail] = useState('')
  const [payerName, setPayerName] = useState('')

  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [intentLoading, setIntentLoading] = useState(false)
  const [intentError, setIntentError] = useState<string | null>(null)

  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
    if (key) setStripePromise(loadStripe(key))
  }, [])

  useEffect(() => {
    if (!token) {
      setError('No payment token provided.')
      setLoading(false)
      return
    }

    async function verifyToken() {
      try {
        const res = await fetch('/api/external/payment-link/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        })
        const json = await res.json()
        if (!res.ok) {
          setError(json.error ?? 'Invalid or expired payment link.')
          return
        }
        const data = json as VerifiedTokenData
        setVerified(data)
        setPayerEmail(data.payerEmail ?? defaultEmail(data.sessionId))
        setPayerName(data.customerName)
      } catch {
        setError('Failed to load payment details. Please try again.')
      } finally {
        setLoading(false)
      }
    }

    verifyToken()
  }, [token])

  async function preparePaymentIntent() {
    if (!token || !verified) return
    setIntentLoading(true)
    setIntentError(null)
    setClientSecret(null)

    try {
      const res = await fetch('/api/external/payment-link/intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, payerEmail }),
      })
      const json = await res.json()
      if (!res.ok) {
        setIntentError(json.error ?? 'Failed to initialize payment.')
        return
      }
      setClientSecret(json.clientSecret)
    } catch {
      setIntentError('Failed to initialize payment. Please try again.')
    } finally {
      setIntentLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#F5EEDE' }}>
      <header className="px-6 py-4 shadow-md" style={{ backgroundColor: '#0E2C20' }}>
        <div className="max-w-md mx-auto flex items-center gap-3">
          <img
            src="/ali-access-logo.svg"
            alt="Ayala Land Access"
            className="h-9 w-9 rounded-md bg-white"
          />
          <span className="text-white font-bold text-base tracking-tight">
            Ayala Land Access
          </span>
        </div>
      </header>

      <main className="flex-1 flex items-start justify-center py-8 px-4">
        <div className="w-full max-w-md">
          <div
            className="bg-white rounded-xl shadow-sm overflow-hidden border"
            style={{ borderColor: '#DDD4C9' }}
          >
            <div
              className="px-6 py-4 border-b"
              style={{ borderColor: '#DDD4C9', backgroundColor: 'rgba(14,44,32,0.05)' }}
            >
              <h1 className="text-lg font-semibold" style={{ color: '#0E2C20' }}>
                Payment Portal
              </h1>
            </div>

            <div className="p-6">
              {loading && (
                <div className="flex flex-col items-center gap-3 py-12">
                  <Loader2 className="h-8 w-8 animate-spin" style={{ color: '#0E2C20' }} />
                  <p className="text-sm" style={{ color: '#383D36' }}>
                    Loading payment details...
                  </p>
                </div>
              )}

              {!loading && error && (
                <div className="py-8 text-center space-y-3">
                  <div
                    className="rounded-lg p-4 border"
                    style={{ backgroundColor: '#FEEFEA', borderColor: '#CE3106' }}
                  >
                    <p className="text-sm font-medium" style={{ color: '#CE3106' }}>
                      {error}
                    </p>
                  </div>
                </div>
              )}

              {!loading && !error && verified && (
                <div className="space-y-6">
                  <div
                    className="rounded-lg border p-4 space-y-2"
                    style={{ borderColor: '#DDD4C9', backgroundColor: '#F5EEDE' }}
                  >
                    <div className="flex justify-between text-sm">
                      <span style={{ color: '#383D36' }}>Invoice</span>
                      <span className="font-medium" style={{ color: '#0E2C20' }}>
                        {verified.invoiceNumber}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span style={{ color: '#383D36' }}>Customer</span>
                      <span className="font-medium" style={{ color: '#0E2C20' }}>
                        {verified.customerName}
                      </span>
                    </div>
                    {verified.dueDate && (
                      <div className="flex justify-between text-sm">
                        <span style={{ color: '#383D36' }}>Due Date</span>
                        <span className="font-medium" style={{ color: '#0E2C20' }}>
                          {verified.dueDate}
                        </span>
                      </div>
                    )}
                    <div
                      className="flex justify-between text-sm border-t pt-2"
                      style={{ borderColor: '#DDD4C9' }}
                    >
                      <span className="font-medium" style={{ color: '#383D36' }}>
                        Amount Due
                      </span>
                      <span
                        className="font-bold text-base"
                        style={{ color: '#0E2C20' }}
                      >
                        ₱{verified.amount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>

                  {!clientSecret && (
                    <div className="space-y-3">
                      <div>
                        <label
                          htmlFor="payer-email"
                          className="text-xs mb-1 block"
                          style={{ color: '#383D36' }}
                        >
                          Email (for receipt)
                        </label>
                        <input
                          id="payer-email"
                          type="email"
                          value={payerEmail}
                          onChange={(e) => setPayerEmail(e.target.value)}
                          className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2"
                          style={{ borderColor: '#DDD4C9', color: '#0E2C20' }}
                          placeholder="you@example.com"
                        />
                      </div>
                      <div>
                        <label
                          htmlFor="payer-name"
                          className="text-xs mb-1 block"
                          style={{ color: '#383D36' }}
                        >
                          Name on card
                        </label>
                        <input
                          id="payer-name"
                          type="text"
                          value={payerName}
                          onChange={(e) => setPayerName(e.target.value)}
                          className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2"
                          style={{ borderColor: '#DDD4C9', color: '#0E2C20' }}
                          placeholder="Cardholder name"
                        />
                      </div>

                      {intentError && (
                        <p
                          className="text-sm rounded-md px-3 py-2 border"
                          style={{ color: '#CE3106', borderColor: '#CE3106', backgroundColor: '#FEEFEA' }}
                        >
                          {intentError}
                        </p>
                      )}

                      <button
                        onClick={preparePaymentIntent}
                        disabled={intentLoading || !payerEmail.trim() || !payerName.trim()}
                        className="w-full py-3 rounded-lg text-white text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors hover:opacity-90"
                        style={{ backgroundColor: '#0E2C20' }}
                      >
                        {intentLoading ? 'Preparing...' : 'Continue to Card Payment'}
                      </button>
                    </div>
                  )}

                  {clientSecret && stripePromise && (
                    <Elements stripe={stripePromise} options={{ clientSecret, appearance }}>
                      <ExternalPaymentForm
                        clientSecret={clientSecret}
                        token={token!}
                        amount={verified.amount}
                        invoiceNumber={verified.invoiceNumber}
                        payerEmail={payerEmail}
                        payerName={payerName}
                      />
                    </Elements>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      <footer className="py-4 px-4 text-center">
        <div
          className="flex items-center justify-center gap-2 text-xs"
          style={{ color: '#383D36' }}
        >
          <ShieldCheck className="h-3.5 w-3.5" style={{ color: '#0E2C20' }} />
          <span>Secured by Ayala Land Access</span>
        </div>
      </footer>
    </div>
  )
}

export default function ExternalPayPageWrapper() {
  return (
    <Suspense
      fallback={
        <div
          className="min-h-screen flex items-center justify-center"
          style={{ backgroundColor: '#F5EEDE' }}
        >
          <Loader2 className="h-8 w-8 animate-spin" style={{ color: '#0E2C20' }} />
        </div>
      }
    >
      <ExternalPayPage />
    </Suspense>
  )
}
```

Key changes vs. previous version:
- Header: `bg-[#0E2C20]` with logo (`<img src="/ali-access-logo.svg" />`) + "Ayala Land Access" wordmark
- Page bg: `#F5EEDE` cream
- Card border: `#DDD4C9`
- All text colors mapped to `#0E2C20` (heading) / `#383D36` (muted)
- Stripe Elements `appearance.colorPrimary` → `#0E2C20`
- Subtitle "Secure checkout via chatbot link" REMOVED — only "Payment Portal" heading remains
- Footer: "Secured by Ayala Land Access" (was "Secured by Ayala Land Collections Portal")
- Removed `paymentIntentId` from response storage (already done in prior work; preserved here)

- [ ] **Step 2: Type-check**

```bash
npm run lint
```

Expected: passes. If `<img>` is flagged with `@next/next/no-img-element` as a NEW error, suppress with `{/* eslint-disable-next-line @next/next/no-img-element */}` directly above the `<img>` line.

- [ ] **Step 3: Browser smoke**

Start `npm run dev`, mint a token (any of the curl commands above), then open the resulting URL. Visually verify:
- Cream page background.
- Forest-green header with logo + "Ayala Land Access" wordmark.
- Card has tan border, white body.
- Card header reads "Payment Portal" (no subtitle).
- Summary box: cream interior, dark green text on labels.
- Inputs: tan borders, dark text.
- "Continue to Card Payment" button: forest green.
- Footer: "Secured by Ayala Land Access" with green ShieldCheck icon.

Stop the dev server.

- [ ] **Step 4: Commit**

```bash
git add app/src/app/pay/external/page.tsx
git commit -m "feat(external-pay): reskin main page to ali-access brand"
```

---

## Task 9: End-to-end smoke test (deploy to main)

This task has no code; it verifies the full chain works on production.

- [ ] **Step 1: Push main**

From `/home/josef/projects/mpe-collections-demo`:

```bash
git push origin main
```

- [ ] **Step 2: Wait for Vercel to redeploy**

```bash
SHA=$(git rev-parse HEAD); echo "Watching $SHA"; for i in 1 2 3 4 5 6 7 8 9 10 11 12; do
  STATE=$(gh api "repos/iOSJedi/mpe-collections-demo/commits/$SHA/statuses" 2>/dev/null | python3 -c "
import sys, json
seen = {}
for s in json.load(sys.stdin):
    ctx = s.get('context')
    if ctx not in seen: seen[ctx] = s.get('state')
print(' | '.join(f'{k}={v}' for k,v in seen.items()) or 'no-statuses-yet')
")
  echo "[$i] $STATE"
  if echo "$STATE" | grep -qE "mpe-collections-demo=(success|failure|error)"; then break; fi
  sleep 15
done
```

Expected: `mpe-collections-demo=success`. If `failure`, ask the user to share `npx vercel inspect <deployment-id> --logs` output.

- [ ] **Step 3: Probe a webhook with webhook.site**

Open `https://webhook.site` in your browser; copy the unique URL it shows (looks like `https://webhook.site/abc-123-def-456`). This is your test callback target. Substitute it into the next steps as `$WEBHOOK_URL`.

- [ ] **Step 4: Mint a URL with callbackUrl**

```bash
WEBHOOK_URL="https://webhook.site/<your-unique-id>"

curl -s -X POST https://mpe-collections-demo.vercel.app/api/external/payment-link \
  -H "Content-Type: application/json" \
  -d "{\"amount\":12500,\"invoiceNumber\":\"EXT-CALLBACK-TEST\",\"customerName\":\"Maria Cruz\",\"payerEmail\":\"smoke@example.com\",\"sessionId\":\"cb-smoke-1\",\"callbackUrl\":\"$WEBHOOK_URL\"}" \
  | python3 -m json.tool
```

Expected: response contains a clean `https://mpe-collections-demo.vercel.app/pay/external?token=...` URL.

- [ ] **Step 5: Open the URL in a browser, verify the reskin**

Expected:
- Cream background page (`#F5EEDE`).
- Forest-green (`#0E2C20`) header with logo + "Ayala Land Access" wordmark.
- Card with tan border, header "Payment Portal" (no subtitle).
- Summary: invoice, customer, due-date (if present), amount due.
- Email pre-filled `chatbot-cb-smoke-1@demo.local`, name pre-filled "Maria Cruz".
- Forest-green "Continue to Card Payment" button.
- Footer: "Secured by Ayala Land Access".

- [ ] **Step 6: Replace the email with something real, click Continue, pay with success card**

Edit email to a real address you control (or leave as `smoke@example.com`). Click "Continue to Card Payment". On the Stripe form, enter:
- Card: `4242 4242 4242 4242`
- Expiry: any future MM/YY
- CVC: any 3 digits
- Postal: any

Click "Pay ₱12,500.00". Expected:
- Brief "Processing..." state.
- Redirect to `/pay/external/success?amount=12500&invoice=EXT-CALLBACK-TEST` (also reskinned).

Switch to the `webhook.site` tab. Expected: a new POST request showing:

```json
{
  "status": "succeeded",
  "invoiceNumber": "EXT-CALLBACK-TEST",
  "amount": 12500,
  "currency": "PHP",
  "paymentIntentId": "pi_...",
  "paymentId": "<rtdb push key>",
  "payerEmail": "...",
  "payerName": "Maria Cruz",
  "sessionId": "cb-smoke-1",
  "timestamp": "2026-04-30T..."
}
```

- [ ] **Step 7: Verify failure callback with a declined card**

Mint a fresh URL (the previous one is fine to reuse if `expiresAt` hasn't passed; or mint a new one with the same `callbackUrl`):

```bash
WEBHOOK_URL="https://webhook.site/<your-unique-id>"

curl -s -X POST https://mpe-collections-demo.vercel.app/api/external/payment-link \
  -H "Content-Type: application/json" \
  -d "{\"amount\":12500,\"invoiceNumber\":\"EXT-CB-FAIL\",\"customerName\":\"Maria Cruz\",\"sessionId\":\"cb-fail-1\",\"callbackUrl\":\"$WEBHOOK_URL\"}"
```

Open the resulting URL. Email/name pre-filled. Click Continue. On the Stripe form, enter the **decline** test card:
- Card: `4000 0000 0000 0002`
- Expiry: any future
- CVC: any
- Postal: any

Click Pay. Expected:
- Inline error appears (something like "Your card was declined.").
- The user stays on the form (no redirect).

Switch to webhook.site. Expected: a new POST request showing:

```json
{
  "status": "failed",
  "invoiceNumber": "EXT-CB-FAIL",
  "amount": 12500,
  "currency": "PHP",
  "errorMessage": "Your card was declined.",
  "sessionId": "cb-fail-1",
  "timestamp": "..."
}
```

- [ ] **Step 8: Verify Firebase RTDB and Stripe both have the success record**

Open the Firebase console for the project, go to Realtime Database → `collections/external_payments`. Expected: a node with the values from Step 6.

Open the Stripe dashboard (test mode) → Payments. Expected: a succeeded PaymentIntent matching the `paymentIntentId` from the webhook payload, with metadata `source=EXTERNAL_LINK`, `invoice_number=EXT-CALLBACK-TEST`, `session_id=cb-smoke-1`.

- [ ] **Step 9: Regression check — existing `/pay` flow still works**

Generate a QR for an existing real invoice through the authenticated dashboard UI (or, if scripts are set up, hit `/api/qr` with a Firebase ID token), open the resulting `/pay?token=...` URL, and verify the existing flow still loads its breakdown view normally and is NOT reskinned (still uses `#003B1F` and the old "AYALA LAND" wordmark).

- [ ] **Step 10: Wrap up**

```bash
git status
```

Expected: clean working tree.

---

## Self-Review Notes

- **Spec coverage:**
  - Visual reskin → Tasks 6, 7, 8.
  - Drop subtitle → Task 8 (explicit in step 1).
  - Callback URL: token field → Task 1; mint validation/embed → Task 2; verify surfacing → Task 3; success callback → Task 4; failure endpoint → Task 5; form integration → Task 7.
  - Logo asset → Task 1 step 2.
  - Demo walkthrough → Task 9.
- **No placeholders:** Every code step contains the actual code; every command step has the actual command and expected output.
- **Type/name consistency:** `cb` field used consistently across types (Task 1), mint (Task 2), verify (Task 3), confirm (Task 4), notify-failure (Task 5). `callbackUrl` is the request/response field name; `cb` is the JWT internal name. `notifyFailure` helper name consistent within Task 7. Color hex values pinned in the plan header and used identically across tasks.
- **No tests** because the project has no test framework. Verification is `npm run lint` + `curl` + browser smoke per task, matching the established codebase pattern.
