# External Payment Link — Design Spec

**Date:** 2026-04-29
**Status:** Draft (awaiting user review)
**Scope:** Demo-only — third-party chatbot integration for the Ayala Land Collections & Payments Portal.

## Goal

Let an external chatbot mint a public payment URL via a single API call, passing all display parameters directly (amount, invoice number, customer name, etc.). The user follows the URL, completes a real Stripe payment, and the result is recorded — without touching the existing `/pay` flow or the Postgres AR tables.

## Non-Goals

- No changes to the existing `/pay`, `/api/qr`, `/api/pay/*` flow, or any Drizzle/Postgres schema.
- No multi-invoice breakdown, no penalty allocation, no CWT auto-issue, no credit ledger interaction.
- No idempotency / single-use token tracking — token is reusable within its 24h expiry.
- No chatbot-side authentication (intentionally fully open for demo ergonomics).

## Architecture

```
Chatbot ──► POST /api/external/payment-link              (open, no auth)
              ├─ signs JWT(amount, invoice#, customer name, due, email?, sessionId?)
              └─ returns { url: ".../pay/external?token=...", expiresAt }

User ──► GET /pay/external?token=...
           ├─ POST /api/external/payment-link/verify     ← decode token → render summary
           ├─ POST /api/external/payment-link/intent     ← create Stripe PaymentIntent
           ├─ Stripe Elements confirms card payment
           └─ POST /api/external/payment-link/confirm    ← verify Stripe + push to RTDB
                                                            collections/external_payments/{pushId}
```

This flow is fully isolated. It shares only:

- The Stripe library (`app/src/lib/stripe.ts`) for `createPaymentIntent` and `stripe.paymentIntents.retrieve`.
- The Firebase Admin SDK module (`app/src/lib/firebase-admin.ts`), which is extended (additively) to expose RTDB.
- The `QR_JWT_SECRET` env var, reused for signing the new token type.

## Token Format

Signed with `QR_JWT_SECRET` (existing env). Different shape from `QrPayload`, so verification of the existing flow's tokens against this verifier (and vice versa) will fail by missing fields — the two payload types stay isolated by structure.

```ts
// app/src/types/index.ts
export interface ExternalPayLinkPayload {
  inv: string        // invoice_number — chatbot-supplied, arbitrary string
  name: string       // customer_name
  amt: number        // amount (PHP, decimal)
  due?: string       // due_date (YYYY-MM-DD), optional
  email?: string     // payer_email, optional
  sid?: string       // session_id from chatbot, optional
  exp: number        // expiry timestamp (ms epoch)
}
```

JWT helpers live in `app/src/lib/external-link/jwt.ts`:

```ts
export function signExternalLinkToken(payload: ExternalPayLinkPayload): string
export function verifyExternalLinkToken(token: string): ExternalPayLinkPayload
```

24-hour expiry, set when the link is minted.

## API Contract

### `POST /api/external/payment-link`

**Auth:** none. Fully open.

**Request body:**

```json
{
  "amount": 12500.00,
  "invoiceNumber": "EXT-2026-001",
  "customerName": "Maria Cruz",
  "dueDate": "2026-05-15",
  "payerEmail": "maria@example.com",
  "sessionId": "chatbot-abc123"
}
```

| Field           | Type   | Required | Notes                                   |
| --------------- | ------ | -------- | --------------------------------------- |
| `amount`        | number | yes      | PHP, > 0                                |
| `invoiceNumber` | string | yes      | Arbitrary identifier, displayed         |
| `customerName`  | string | yes      | Displayed                               |
| `dueDate`       | string | no       | YYYY-MM-DD, displayed if present        |
| `payerEmail`    | string | no       | Pre-fills email field on the page       |
| `sessionId`     | string | no       | Used for default email + RTDB record    |

**Response:**

```json
{
  "url": "https://mpe-payments-demo.vercel.app/pay/external?token=eyJ...",
  "expiresAt": "2026-04-30T14:23:00.000Z"
}
```

**Errors:** `400` for missing/invalid required fields. `500` for unexpected errors.

### `POST /api/external/payment-link/verify`

**Auth:** none.

**Request:** `{ "token": "..." }`

**Response:** decoded payload, normalized for the page:

```json
{
  "amount": 12500.00,
  "invoiceNumber": "EXT-2026-001",
  "customerName": "Maria Cruz",
  "dueDate": "2026-05-15",
  "payerEmail": "maria@example.com",
  "sessionId": "chatbot-abc123",
  "expiresAt": "2026-04-30T14:23:00.000Z"
}
```

**Errors:** `401` for invalid/expired token.

### `POST /api/external/payment-link/intent`

**Auth:** none.

**Request:** `{ "token": "...", "payerEmail": "user@whatever.com" }`

`payerEmail` overrides the email baked into the token (because the page lets the user edit it). If neither is provided, the page generates a default before calling.

**Behavior:**
1. Verify token. Reject if invalid/expired.
2. Use `amount` from token (not from request body — never trust client for the charge amount).
3. Call `createPaymentIntent(Math.round(amt * 100), { invoice_number, customer_name, payer_email, session_id, source: 'EXTERNAL_LINK' })`. The metadata is what tools like the Stripe dashboard show.
4. Set `receipt_email = payerEmail` on the PaymentIntent so the customer receives a Stripe receipt.

**Response:** `{ "clientSecret": "...", "paymentIntentId": "pi_..." }`

### `POST /api/external/payment-link/confirm`

**Auth:** none.

**Request:**

```json
{
  "token": "...",
  "paymentIntentId": "pi_...",
  "payerEmail": "user@whatever.com",
  "payerName": "Maria Cruz"
}
```

**Behavior:**
1. Verify token.
2. `stripe.paymentIntents.retrieve(paymentIntentId)`. Reject unless `status === 'succeeded'`.
3. Push to RTDB at `collections/external_payments/{autoId}` (see record shape below).
4. Return `{ "success": true, "paymentId": "<rtdb push id>" }`.

**Errors:** `400` if Stripe status not succeeded; `401` for invalid/expired token; `500` for Firebase errors.

## RTDB Record Shape

**Path:** `collections/external_payments/{autoId}`

```json
{
  "createdAt": <ServerValue.TIMESTAMP>,
  "amount": 12500.00,
  "currency": "PHP",
  "invoiceNumber": "EXT-2026-001",
  "customerName": "Maria Cruz",
  "dueDate": "2026-05-15",
  "payerEmail": "maria@example.com",
  "payerName": "Maria Cruz",
  "sessionId": "chatbot-abc123",
  "stripePaymentIntentId": "pi_xxx",
  "status": "CONFIRMED",
  "source": "EXTERNAL_LINK"
}
```

Optional fields (`dueDate`, `sessionId`, `payerName`) are omitted from the RTDB record when not present, rather than written as `null` — keeps the tree clean for demo viewing.

No reads are performed against this path by application code; it's a write-only audit log for the demo. The Firebase console serves as the viewer.

## Page: `/pay/external`

Slim, focused payment view. Does **not** reuse `PaymentForm` (that component is tightly coupled to invoiceId/customerId from Postgres).

**File:** `app/src/app/pay/external/page.tsx`

**Structure:**
- Header (Ayala Land brand, identical to `/pay`).
- Payment summary card: customer name, invoice number, due date if present, amount in ₱.
- Email field: pre-filled with `payerEmail` from the verified token. If absent, default = `chatbot-{sessionId}@demo.local` (or `chatbot-{random8}@demo.local` if no `sessionId`). Editable.
- Optional payer name field: pre-filled with `customerName`, editable.
- Stripe Elements card form (`ExternalPaymentForm` component).
- "Pay ₱X" button → `intent` → `stripe.confirmCardPayment` → `confirm` → redirect to `/pay/external/success`.
- Footer (matches `/pay`).

**Component:** `app/src/components/pay/external/ExternalPaymentForm.tsx` — slim Stripe Elements wrapper, modeled on the existing `PaymentForm` but stripped of all DB-aware bits (no invoiceId, no customerId, no allocation, no CWT trigger).

**Success page:** `app/src/app/pay/external/success/page.tsx` — confirmation message with paid amount, invoice number, and a "Done" message. No links back into the authenticated app since the payer is not logged in.

## File Manifest

### New files
| Path                                                                | Purpose                                  |
| ------------------------------------------------------------------- | ---------------------------------------- |
| `app/src/app/pay/external/page.tsx`                                 | Public payment page                      |
| `app/src/app/pay/external/success/page.tsx`                         | Post-payment confirmation page           |
| `app/src/app/api/external/payment-link/route.ts`                    | POST: mint URL                           |
| `app/src/app/api/external/payment-link/verify/route.ts`             | POST: decode token                       |
| `app/src/app/api/external/payment-link/intent/route.ts`             | POST: create Stripe PaymentIntent        |
| `app/src/app/api/external/payment-link/confirm/route.ts`            | POST: verify Stripe + RTDB push          |
| `app/src/lib/external-link/jwt.ts`                                  | Sign/verify token helpers                |
| `app/src/components/pay/external/ExternalPaymentForm.tsx`           | Slim Stripe Elements form                |

### Touched files (additive only)
| Path                                | Change                                                                                       |
| ----------------------------------- | -------------------------------------------------------------------------------------------- |
| `app/src/lib/firebase-admin.ts`     | Add `databaseURL` to `initializeApp`, export new `getRtdb()` helper. Existing `getAuth()` unchanged. |
| `app/src/types/index.ts`            | Add `ExternalPayLinkPayload` interface.                                                      |
| `app/.env.example`                  | Document `FIREBASE_DATABASE_URL` (admin-side fallback to `NEXT_PUBLIC_FIREBASE_DATABASE_URL`). |

### Untouched (explicit)
- `app/src/app/pay/page.tsx`, `app/src/app/pay/enroll/**`
- `app/src/app/api/qr/**`, `app/src/app/api/pay/**`
- `app/src/db/schema.ts` and all Drizzle code
- All other components

## Firebase Admin Init Change

Currently `firebase-admin.ts` only initializes the credential and exports `getAuth()`. Additive change:

```ts
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: process.env.FIREBASE_DATABASE_URL || process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
})

export function getRtdb() {
  ensureInitialized()
  return admin.apps.length > 0 ? admin.database() : null
}
```

Existing call sites (`getAuth()` from `auth-middleware.ts`) are untouched.

## Demo Walkthrough

```bash
# 1. Chatbot mints a URL
curl -X POST https://mpe-payments-demo.vercel.app/api/external/payment-link \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 12500,
    "invoiceNumber": "EXT-2026-001",
    "customerName": "Maria Cruz",
    "sessionId": "chatbot-abc123"
  }'
# → { "url": "https://.../pay/external?token=eyJ...", "expiresAt": "2026-04-30T..." }

# 2. User opens URL — sees ₱12,500 due, customer "Maria Cruz",
#    email field pre-filled "chatbot-abc123@demo.local" (editable).

# 3. User pays with Stripe test card 4242 4242 4242 4242.

# 4. Success page shown. RTDB record visible at
#    https://console.firebase.google.com/.../database/.../data/collections/external_payments
```

## Risks & Open Questions

- **Open API endpoint** — anyone can mint links. Acceptable for demo; flag if this gets shared widely.
- **Stripe in test or live mode?** — uses whatever `STRIPE_SECRET_KEY` is currently configured in the environment, same as the existing flow. No mode change introduced.
- **RTDB security rules** — server-side writes via Admin SDK bypass rules entirely, so no rule changes required. Reads (e.g. via Firebase console) need authenticated access, which Ayala admins have.
- **Email auto-generation** — using `@demo.local` (a clearly fake TLD) avoids accidentally sending Stripe receipts to real domains the user didn't intend. The user can replace with a real email on the page if they want a receipt.

## Out of Scope for This Spec

- Reading the RTDB log back into any UI inside the app.
- Refunds, cancellations, partial payment from the chatbot flow.
- Webhook-driven async confirmation (we use synchronous `paymentIntents.retrieve` instead).
- Promoting external payment records into Postgres / matching them to real invoices later.
