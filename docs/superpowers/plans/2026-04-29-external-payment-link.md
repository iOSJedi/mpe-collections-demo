# External Payment Link Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an isolated, fully-open chatbot-driven payment flow that mints signed Stripe payment URLs from arbitrary parameters and writes confirmed payments to Firebase RTDB — without touching the existing `/pay` flow or Postgres.

**Architecture:** Four new unauthenticated POST endpoints under `/api/external/payment-link/*`, a new public page at `/pay/external` with its own Stripe Elements form, a thin JWT helper module, and a small additive change to `firebase-admin.ts` to enable RTDB writes. All payment records land at `collections/external_payments/{autoId}` in RTDB.

**Tech Stack:** Next.js 16 App Router, Stripe (PHP), `jsonwebtoken`, Firebase Admin SDK (RTDB), `@stripe/react-stripe-js` Elements.

**Spec:** `docs/superpowers/specs/2026-04-29-external-payment-link-design.md`

**Important context:** No test framework is configured in this project. Verification per task is via `npm run lint`, manual `curl` for API endpoints, and browser smoke tests for UI. This matches how the existing `/pay` flow was built. Always run commands from `/app` (the Next.js project root) unless otherwise stated.

---

## Task 1: Add token type + JWT helper module

**Files:**
- Modify: `app/src/types/index.ts` (append at end of file)
- Create: `app/src/lib/external-link/jwt.ts`

- [ ] **Step 1: Add the `ExternalPayLinkPayload` type to `app/src/types/index.ts`**

Append to the end of the file:

```ts
// External payment link (chatbot-driven flow)
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

- [ ] **Step 2: Create `app/src/lib/external-link/jwt.ts`**

```ts
import jwt from 'jsonwebtoken'
import { ExternalPayLinkPayload } from '@/types'

const SECRET = process.env.QR_JWT_SECRET || 'demo-secret-change-in-production'

export function signExternalLinkToken(payload: ExternalPayLinkPayload): string {
  return jwt.sign(payload, SECRET)
}

export function verifyExternalLinkToken(token: string): ExternalPayLinkPayload {
  return jwt.verify(token, SECRET) as ExternalPayLinkPayload
}
```

- [ ] **Step 3: Type-check**

Run from `/app`:
```bash
npm run lint
```
Expected: passes (or reports only pre-existing warnings, no new errors).

- [ ] **Step 4: Commit**

```bash
git add app/src/types/index.ts app/src/lib/external-link/jwt.ts
git commit -m "feat(external-pay): add token type and JWT helpers"
```

---

## Task 2: Enable RTDB on Firebase Admin SDK

**Files:**
- Modify: `app/src/lib/firebase-admin.ts`
- Modify: `app/.env.example`

- [ ] **Step 1: Replace the entire contents of `app/src/lib/firebase-admin.ts`**

```ts
import admin from 'firebase-admin'

function getServiceAccount() {
  if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
    console.error('[Firebase Admin] FIREBASE_SERVICE_ACCOUNT env var is not set')
    return null
  }
  try {
    return JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
  } catch {
    console.error('[Firebase Admin] Failed to parse FIREBASE_SERVICE_ACCOUNT JSON')
    return null
  }
}

let _initialized = false

function ensureInitialized() {
  if (_initialized) return
  _initialized = true

  const serviceAccount = getServiceAccount()
  if (serviceAccount && !admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      databaseURL:
        process.env.FIREBASE_DATABASE_URL ||
        process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
    })
  }
}

export function getAuth() {
  ensureInitialized()
  return admin.apps.length > 0 ? admin.auth() : null
}

export function getRtdb() {
  ensureInitialized()
  return admin.apps.length > 0 ? admin.database() : null
}

export default admin
```

The only changes are: (a) `databaseURL` added to `initializeApp`, (b) new `getRtdb()` export. Existing `getAuth()` behavior is preserved exactly.

- [ ] **Step 2: Document the env var in `app/.env.example`**

Find the `# Firebase` section and add `FIREBASE_DATABASE_URL=` directly under `FIREBASE_SERVICE_ACCOUNT=`. The block should look like:

```
# Firebase
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_DATABASE_URL=
FIREBASE_SERVICE_ACCOUNT=
FIREBASE_DATABASE_URL=
```

- [ ] **Step 3: Type-check**

Run from `/app`:
```bash
npm run lint
```
Expected: passes.

- [ ] **Step 4: Commit**

```bash
git add app/src/lib/firebase-admin.ts app/.env.example
git commit -m "feat(firebase-admin): expose RTDB via getRtdb()"
```

---

## Task 3: Mint endpoint — `POST /api/external/payment-link`

**Files:**
- Create: `app/src/app/api/external/payment-link/route.ts`

- [ ] **Step 1: Create the route file**

```ts
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

    const token = signExternalLinkToken(payload)

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const url = `${appUrl}/pay/external?token=${token}`

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
```

- [ ] **Step 2: Type-check**

Run from `/app`:
```bash
npm run lint
```
Expected: passes.

- [ ] **Step 3: Manually verify with curl**

In one terminal, from `/app`:
```bash
npm run dev
```

Wait until you see `Ready in ...`. Then in another terminal:

```bash
curl -s -X POST http://localhost:3000/api/external/payment-link \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 12500,
    "invoiceNumber": "EXT-2026-001",
    "customerName": "Maria Cruz",
    "sessionId": "chatbot-abc123"
  }' | python3 -m json.tool
```

Expected output:
```json
{
    "url": "http://localhost:3000/pay/external?token=eyJ...",
    "expiresAt": "2026-04-30T..."
}
```

Also verify the validation rejection:
```bash
curl -s -X POST http://localhost:3000/api/external/payment-link \
  -H "Content-Type: application/json" \
  -d '{"amount": -5, "invoiceNumber": "x", "customerName": "y"}' | python3 -m json.tool
```
Expected: `{"error": "amount must be a positive number"}`

- [ ] **Step 4: Commit**

```bash
git add app/src/app/api/external/payment-link/route.ts
git commit -m "feat(external-pay): mint endpoint for signed payment URLs"
```

---

## Task 4: Verify endpoint — `POST /api/external/payment-link/verify`

**Files:**
- Create: `app/src/app/api/external/payment-link/verify/route.ts`

- [ ] **Step 1: Create the route file**

```ts
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
      expiresAt: new Date(payload.exp).toISOString(),
    })
  } catch (error) {
    console.error('Failed to verify external payment-link token:', error)
    return NextResponse.json({ error: 'Failed to verify token' }, { status: 500 })
  }
}
```

- [ ] **Step 2: Type-check**

Run from `/app`:
```bash
npm run lint
```
Expected: passes.

- [ ] **Step 3: Manually verify the mint→verify chain**

With `npm run dev` still running:

```bash
TOKEN=$(curl -s -X POST http://localhost:3000/api/external/payment-link \
  -H "Content-Type: application/json" \
  -d '{"amount": 12500, "invoiceNumber": "EXT-2026-001", "customerName": "Maria Cruz", "sessionId": "chatbot-abc123"}' \
  | python3 -c "import sys, json; u=json.load(sys.stdin)['url']; print(u.split('token=')[1])")

echo "Token: $TOKEN"

curl -s -X POST http://localhost:3000/api/external/payment-link/verify \
  -H "Content-Type: application/json" \
  -d "{\"token\": \"$TOKEN\"}" | python3 -m json.tool
```

Expected: JSON containing `amount: 12500`, `invoiceNumber: "EXT-2026-001"`, `customerName: "Maria Cruz"`, `sessionId: "chatbot-abc123"`, plus `expiresAt`. No `dueDate` or `payerEmail` keys (omitted) or set to `null` — both are acceptable since the source omitted them.

Also verify rejection of garbage tokens:
```bash
curl -s -X POST http://localhost:3000/api/external/payment-link/verify \
  -H "Content-Type: application/json" \
  -d '{"token": "not-a-real-token"}'
```
Expected: HTTP 401, body `{"error": "Invalid or expired token"}`.

- [ ] **Step 4: Commit**

```bash
git add app/src/app/api/external/payment-link/verify/route.ts
git commit -m "feat(external-pay): verify endpoint for token decoding"
```

---

## Task 5: Stripe intent endpoint — `POST /api/external/payment-link/intent`

**Files:**
- Create: `app/src/app/api/external/payment-link/intent/route.ts`

- [ ] **Step 1: Create the route file**

```ts
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
```

This uses the `stripe` proxy directly (rather than `createPaymentIntent`) because we need `receipt_email` and the helper doesn't take it.

- [ ] **Step 2: Type-check**

Run from `/app`:
```bash
npm run lint
```
Expected: passes.

- [ ] **Step 3: Manually verify with curl**

With `npm run dev` running and `STRIPE_SECRET_KEY` set in `/app/.env`:

```bash
TOKEN=$(curl -s -X POST http://localhost:3000/api/external/payment-link \
  -H "Content-Type: application/json" \
  -d '{"amount": 12500, "invoiceNumber": "EXT-2026-001", "customerName": "Maria Cruz"}' \
  | python3 -c "import sys, json; u=json.load(sys.stdin)['url']; print(u.split('token=')[1])")

curl -s -X POST http://localhost:3000/api/external/payment-link/intent \
  -H "Content-Type: application/json" \
  -d "{\"token\": \"$TOKEN\", \"payerEmail\": \"test@demo.local\"}" | python3 -m json.tool
```

Expected: `{"clientSecret": "pi_..._secret_...", "paymentIntentId": "pi_..."}`.

In the Stripe dashboard (test mode), under Payments, you should see a new PaymentIntent for ₱12,500 with metadata `source=EXTERNAL_LINK`, `invoice_number=EXT-2026-001`, `customer_name=Maria Cruz`, `payer_email=test@demo.local`, and `receipt_email=test@demo.local`.

- [ ] **Step 4: Commit**

```bash
git add app/src/app/api/external/payment-link/intent/route.ts
git commit -m "feat(external-pay): Stripe PaymentIntent endpoint with receipt email"
```

---

## Task 6: Confirm endpoint — `POST /api/external/payment-link/confirm` with RTDB push

**Files:**
- Create: `app/src/app/api/external/payment-link/confirm/route.ts`

- [ ] **Step 1: Create the route file**

```ts
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
```

- [ ] **Step 2: Type-check**

Run from `/app`:
```bash
npm run lint
```
Expected: passes.

- [ ] **Step 3: Manual smoke deferred until UI exists**

Confirming this endpoint requires a real `succeeded` Stripe PaymentIntent. We'll exercise it end-to-end after the UI is built (Task 9). For now, just verify the route file compiles.

- [ ] **Step 4: Commit**

```bash
git add app/src/app/api/external/payment-link/confirm/route.ts
git commit -m "feat(external-pay): confirm endpoint writes to Firebase RTDB"
```

---

## Task 7: Success page — `/pay/external/success`

**Files:**
- Create: `app/src/app/pay/external/success/page.tsx`

- [ ] **Step 1: Create the success page**

```tsx
'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { CheckCircle2, ShieldCheck, Loader2 } from 'lucide-react'

function SuccessPage() {
  const searchParams = useSearchParams()
  const amount = searchParams.get('amount')
  const invoice = searchParams.get('invoice')

  const amountDisplay = amount
    ? `₱${Number(amount).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`
    : null

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      <header className="bg-[#003B1F] px-6 py-4 shadow-md">
        <div className="max-w-md mx-auto">
          <span className="text-[#C9A84C] font-bold text-xl tracking-widest uppercase">
            AYALA LAND
          </span>
        </div>
      </header>

      <main className="flex-1 flex items-start justify-center py-8 px-4">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-8 flex flex-col items-center gap-3 text-center">
              <CheckCircle2 className="h-14 w-14 text-green-600" />
              <h1 className="text-xl font-semibold text-[#003B1F]">Payment Successful</h1>
              {amountDisplay && (
                <p className="text-2xl font-bold text-[#003B1F]">{amountDisplay}</p>
              )}
              {invoice && (
                <p className="text-sm text-slate-500">Invoice {invoice}</p>
              )}
              <p className="text-sm text-slate-500 mt-2">
                Your payment has been processed and confirmed. A receipt has been emailed
                to the address you provided.
              </p>
            </div>
          </div>
        </div>
      </main>

      <footer className="py-4 px-4 text-center">
        <div className="flex items-center justify-center gap-2 text-xs text-slate-500">
          <ShieldCheck className="h-3.5 w-3.5 text-[#003B1F]" />
          <span>Secured by Ayala Land Collections Portal</span>
        </div>
      </footer>
    </div>
  )
}

export default function SuccessPageWrapper() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-[#003B1F]" />
        </div>
      }
    >
      <SuccessPage />
    </Suspense>
  )
}
```

- [ ] **Step 2: Type-check**

Run from `/app`:
```bash
npm run lint
```
Expected: passes.

- [ ] **Step 3: Visually smoke-test the page**

With `npm run dev` running, open in a browser:

```
http://localhost:3000/pay/external/success?amount=12500&invoice=EXT-2026-001
```

Expected: success card with green checkmark, "₱12,500.00", "Invoice EXT-2026-001", and the receipt blurb. Header/footer match the existing `/pay` page.

- [ ] **Step 4: Commit**

```bash
git add app/src/app/pay/external/success/page.tsx
git commit -m "feat(external-pay): success confirmation page"
```

---

## Task 8: Stripe Elements form component — `ExternalPaymentForm`

**Files:**
- Create: `app/src/components/pay/external/ExternalPaymentForm.tsx`

- [ ] **Step 1: Create the component**

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
      color: '#1e293b',
      fontFamily: 'Inter, system-ui, sans-serif',
      fontSize: '16px',
      fontSmoothing: 'antialiased',
      '::placeholder': { color: '#94a3b8' },
    },
    invalid: { color: '#dc2626', iconColor: '#dc2626' },
  },
  hidePostalCode: false,
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
      setError(stripeError.message ?? 'Payment failed.')
      setLoading(false)
      return
    }

    if (paymentIntent?.status !== 'succeeded') {
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
        setError(data.error ?? 'Failed to record payment.')
        setLoading(false)
        return
      }

      const params = new URLSearchParams({
        amount: String(amount),
        invoice: invoiceNumber,
      })
      router.push(`/pay/external/success?${params.toString()}`)
    } catch {
      setError('Failed to record payment. Please contact support.')
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <CardElement options={CARD_ELEMENT_OPTIONS} />
      </div>

      {error && (
        <p className="text-sm text-red-600 rounded-md bg-red-50 border border-red-200 px-3 py-2">
          {error}
        </p>
      )}

      <Button
        onClick={handlePay}
        disabled={!stripe || loading}
        className="w-full bg-[#003B1F] hover:bg-[#003B1F]/90 text-white"
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

      <p className="text-xs text-center text-slate-400">
        Secured by Stripe. Card details are never stored on our servers.
      </p>
    </div>
  )
}
```

- [ ] **Step 2: Type-check**

Run from `/app`:
```bash
npm run lint
```
Expected: passes.

- [ ] **Step 3: Commit**

```bash
git add app/src/components/pay/external/ExternalPaymentForm.tsx
git commit -m "feat(external-pay): slim Stripe Elements form for external flow"
```

---

## Task 9: Public page — `/pay/external`

**Files:**
- Create: `app/src/app/pay/external/page.tsx`

- [ ] **Step 1: Create the page**

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
  expiresAt: string
}

const appearance: Appearance = {
  theme: 'flat',
  variables: {
    colorPrimary: '#003B1F',
    colorBackground: '#ffffff',
    fontFamily: 'Inter, system-ui, sans-serif',
  },
  rules: { '.Label': { color: '#64748b' } },
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
  const [paymentIntentId, setPaymentIntentId] = useState<string | null>(null)
  const [intentLoading, setIntentLoading] = useState(false)
  const [intentError, setIntentError] = useState<string | null>(null)

  // Load Stripe lazily on the client.
  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
    if (key) setStripePromise(loadStripe(key))
  }, [])

  // Verify the token once on mount.
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
      setPaymentIntentId(json.paymentIntentId)
    } catch {
      setIntentError('Failed to initialize payment. Please try again.')
    } finally {
      setIntentLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      <header className="bg-[#003B1F] px-6 py-4 shadow-md">
        <div className="max-w-md mx-auto">
          <span className="text-[#C9A84C] font-bold text-xl tracking-widest uppercase">
            AYALA LAND
          </span>
        </div>
      </header>

      <main className="flex-1 flex items-start justify-center py-8 px-4">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="bg-[#003B1F]/5 border-b border-slate-200 px-6 py-4">
              <h1 className="text-lg font-semibold text-[#003B1F]">Payment Portal</h1>
              <p className="text-xs text-slate-500 mt-0.5">Secure checkout via chatbot link</p>
            </div>

            <div className="p-6">
              {loading && (
                <div className="flex flex-col items-center gap-3 py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-[#003B1F]" />
                  <p className="text-sm text-slate-500">Loading payment details...</p>
                </div>
              )}

              {!loading && error && (
                <div className="py-8 text-center space-y-3">
                  <div className="rounded-lg bg-red-50 border border-red-200 p-4">
                    <p className="text-sm text-red-700 font-medium">{error}</p>
                  </div>
                </div>
              )}

              {!loading && !error && verified && (
                <div className="space-y-6">
                  {/* Summary */}
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">Invoice</span>
                      <span className="font-medium text-slate-800">{verified.invoiceNumber}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">Customer</span>
                      <span className="font-medium text-slate-800">{verified.customerName}</span>
                    </div>
                    {verified.dueDate && (
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-500">Due Date</span>
                        <span className="font-medium text-slate-800">{verified.dueDate}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-sm border-t border-slate-200 pt-2">
                      <span className="text-slate-600 font-medium">Amount Due</span>
                      <span className="font-bold text-[#003B1F] text-base">
                        ₱{verified.amount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>

                  {/* Payer info */}
                  {!clientSecret && (
                    <div className="space-y-3">
                      <div>
                        <label className="text-xs text-slate-500 mb-1 block">Email (for receipt)</label>
                        <input
                          type="email"
                          value={payerEmail}
                          onChange={(e) => setPayerEmail(e.target.value)}
                          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#003B1F]/30 focus:border-[#003B1F]"
                          placeholder="you@example.com"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-slate-500 mb-1 block">Name on card</label>
                        <input
                          type="text"
                          value={payerName}
                          onChange={(e) => setPayerName(e.target.value)}
                          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#003B1F]/30 focus:border-[#003B1F]"
                          placeholder="Cardholder name"
                        />
                      </div>

                      {intentError && (
                        <p className="text-sm text-red-600 rounded-md bg-red-50 border border-red-200 px-3 py-2">
                          {intentError}
                        </p>
                      )}

                      <button
                        onClick={preparePaymentIntent}
                        disabled={intentLoading || !payerEmail.trim()}
                        className="w-full py-3 rounded-lg bg-[#003B1F] hover:bg-[#003B1F]/90 text-white text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        {intentLoading ? 'Preparing...' : 'Continue to Card Payment'}
                      </button>
                    </div>
                  )}

                  {/* Stripe form */}
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
        <div className="flex items-center justify-center gap-2 text-xs text-slate-500">
          <ShieldCheck className="h-3.5 w-3.5 text-[#003B1F]" />
          <span>Secured by Ayala Land Collections Portal</span>
        </div>
      </footer>
    </div>
  )
}

export default function ExternalPayPageWrapper() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-[#003B1F]" />
        </div>
      }
    >
      <ExternalPayPage />
    </Suspense>
  )
}
```

- [ ] **Step 2: Type-check**

Run from `/app`:
```bash
npm run lint
```
Expected: passes.

- [ ] **Step 3: Commit**

```bash
git add app/src/app/pay/external/page.tsx
git commit -m "feat(external-pay): public payment page wired end-to-end"
```

---

## Task 10: End-to-end smoke test

This task has no code — only verification that the full chain works.

- [ ] **Step 1: Mint a URL**

With `npm run dev` running, from `/app`:

```bash
curl -s -X POST http://localhost:3000/api/external/payment-link \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 12500,
    "invoiceNumber": "EXT-2026-001",
    "customerName": "Maria Cruz",
    "dueDate": "2026-05-15",
    "sessionId": "chatbot-abc123"
  }'
```

Copy the `url` value from the response.

- [ ] **Step 2: Open the URL in a browser**

Expected: payment portal page loads with:
- Invoice: `EXT-2026-001`
- Customer: `Maria Cruz`
- Due Date: `2026-05-15`
- Amount Due: `₱12,500.00`
- Email field pre-filled: `chatbot-chatbot-abc123@demo.local`
- Name on card pre-filled: `Maria Cruz`

- [ ] **Step 3: Edit the email to a real-looking value**

Change the email to `you+demo@example.com` (or any address you can check). Click **Continue to Card Payment**.

Expected: card element appears.

- [ ] **Step 4: Pay with the Stripe test card**

Card number: `4242 4242 4242 4242`, any future expiry, any CVC, any postal code. Click the **Pay ₱12,500.00** button.

Expected:
- Brief "Processing..." state
- Redirect to `/pay/external/success?amount=12500&invoice=EXT-2026-001`
- Green checkmark, "₱12,500.00", "Invoice EXT-2026-001"

- [ ] **Step 5: Verify the Firebase RTDB record**

Open the Firebase console for the project, go to Realtime Database, navigate to `collections/external_payments`. Expected: a new auto-id node containing fields `amount: 12500`, `currency: "PHP"`, `invoiceNumber: "EXT-2026-001"`, `customerName: "Maria Cruz"`, `payerEmail: "you+demo@example.com"`, `payerName: "Maria Cruz"`, `sessionId: "chatbot-abc123"`, `dueDate: "2026-05-15"`, `stripePaymentIntentId: "pi_..."`, `status: "CONFIRMED"`, `source: "EXTERNAL_LINK"`, `createdAt: <timestamp>`.

- [ ] **Step 6: Verify the Stripe PaymentIntent**

In the Stripe dashboard (test mode), under Payments, find the PaymentIntent matching the `stripePaymentIntentId` from RTDB. Expected: status **Succeeded**, amount **₱12,500.00**, metadata has `source=EXTERNAL_LINK`, `invoice_number=EXT-2026-001`, `customer_name=Maria Cruz`, `session_id=chatbot-abc123`, `payer_email=you+demo@example.com`, and `Receipt email` shows the same email.

- [ ] **Step 7: Verify the existing flow still works**

This is the regression check — all of the above must not have broken `/pay`. Generate a QR for an existing invoice through the authenticated UI (or from the `/api/qr` endpoint with a valid Firebase ID token), open the resulting `/pay?token=...` URL, and confirm it still loads the breakdown view normally.

- [ ] **Step 8: Final commit (if any pending) and wrap-up**

```bash
git status
```
Expected: clean working tree (all earlier tasks already committed). If anything is left over (e.g. leftover scratch files), commit or discard before finishing.

---

## Self-Review Notes

- **Spec coverage:** Every section of the spec maps to a task — types/JWT (Task 1), Firebase Admin (Task 2), four endpoints (Tasks 3–6), success page (Task 7), form (Task 8), main page (Task 9), end-to-end (Task 10). Demo curl example in spec is reproduced in Task 10.
- **No placeholders:** Every step contains the actual code or exact command.
- **Type/name consistency:** `signExternalLinkToken` / `verifyExternalLinkToken` used consistently. `ExternalPayLinkPayload` field names (`inv`, `name`, `amt`, `due`, `email`, `sid`, `exp`) used consistently across types, JWT, mint, verify, intent, and confirm. Verify endpoint's response shape (`amount`, `invoiceNumber`, `customerName`, `dueDate`, `payerEmail`, `sessionId`, `expiresAt`) matches the page's `VerifiedTokenData` interface and the spec.
- **No TDD because no test framework** — verification is via lint + curl + browser, matching how the existing `/pay` flow was verified.
