# External Payment Page — Ayala Land Access Reskin + Chatbot Callback URL

**Date:** 2026-04-30
**Status:** Draft (awaiting user review)
**Builds on:** `2026-04-29-external-payment-link-design.md`

## Goal

1. Reskin the public `/pay/external` flow to match the Ayala Land Access brand (cream/forest-green palette, "A" logo, Manrope/Inter fonts).
2. Drop the "Secure checkout via chatbot link" subtitle.
3. Add an optional `callbackUrl` parameter to the mint API. After payment succeeds (server-side) or fails (client-side), the chatbot's URL is notified by HTTP POST.

## Non-Goals

- No changes to the existing `/pay` flow, the QR API, or the `/api/qr` endpoint.
- No changes to global Tailwind theme (`globals.css` / `tailwind.config.ts`). Ali-access colors are inlined per file, matching the pattern the existing `/pay` page uses (`#003B1F` hardcoded).
- No HMAC signature on the callback — the chatbot is expected to identify the run via the JWT-derived `sessionId` / `invoiceNumber`. Authentication can be added later if real third-party integrations land.
- No "page-loaded" / heartbeat callbacks. Only meaningful events (success, failure) fire.
- No retries on callback POST failures. Fire-and-forget; logged on the server, dropped on error.

## Visual Reskin

### Palette (sourced from `~/projects/ali-access-chatbot/app/src/app/globals.css`)

| Token              | Hex        | Role in our pages                                  |
| ------------------ | ---------- | -------------------------------------------------- |
| Cream background   | `#F5EEDE`  | Page bg (replaces `bg-slate-100`)                  |
| Forest green       | `#0E2C20`  | Header bar, primary button, headings (replaces `#003B1F`) |
| Warm gray (muted)  | `#383D36`  | Secondary/label text (replaces `text-slate-500/600`) |
| Warm tan (border)  | `#DDD4C9`  | Card borders, input borders (replaces `border-slate-200/300`) |
| Ember accent       | `#CE3106`  | Reserved for error states / destructive cues       |
| White card         | `#FFFFFF`  | Card body (unchanged)                              |

### Logo

Copy `~/projects/ali-access-chatbot/app/public/logo.svg` (a 180×180 white-rounded-square containing the green "A" mark in `#0E2C20`) into `app/public/ali-access-logo.svg`. Header renders the logo at 36×36 with a "Ayala Land Access" wordmark in `font-display` (Manrope) beside it.

### Typography

The mpe-collections-demo project does not currently load Manrope. The brand uses **Inter** (already in the stack) for body and **Manrope** for the wordmark/headings. To avoid touching `globals.css` or `layout.tsx` (shared with the rest of the app), the external page imports both fonts via a `<link>` tag injected through `next/font` only in this single page — or, simpler, references both via inline `style={{ fontFamily: ... }}` and accepts the system fallback if Manrope isn't loaded.

**Decision: simplest path** — use Tailwind utility `font-bold` and rely on Inter (already used app-wide). Skip Manrope for now since loading it adds complexity for one wordmark. Wordmark uses `tracking-tight` + `font-bold` Inter at appropriate size to read as a brand mark.

### Subtitle removal

The card header currently shows:
```
Payment Portal
Secure checkout via chatbot link
```
After: **just** "Payment Portal" (single line, no subtitle).

## API Changes

### Token type extension

```ts
export interface ExternalPayLinkPayload {
  inv: string
  name: string
  amt: number
  due?: string
  email?: string
  sid?: string
  cb?: string         // ← NEW: callback URL for chatbot notifications
  exp: number
}
```

### Mint endpoint — `POST /api/external/payment-link`

**New optional field in request body:**

```json
{
  "amount": 12500,
  "invoiceNumber": "EXT-...",
  "customerName": "Maria Cruz",
  "callbackUrl": "https://chatbot.example.com/payment-webhook"
}
```

When `callbackUrl` is provided:
- Must be a valid absolute URL parseable by `new URL(callbackUrl)`.
- Must use `http:` or `https:` protocol. Other schemes (`javascript:`, `file:`, etc.) are rejected with 400.
- Embedded in the signed token as `payload.cb`.

When omitted: payload's `cb` field is absent; no callbacks fire.

### Verify endpoint — `POST /api/external/payment-link/verify`

Returns the new field in response payload:

```json
{
  ...,
  "callbackUrl": "https://chatbot.example.com/payment-webhook"
}
```

(Page doesn't display this — it's surfaced for completeness and possible future client-side use.)

### Confirm endpoint — `POST /api/external/payment-link/confirm`

After RTDB push succeeds and BEFORE returning the 200 response, fire a callback if `payload.cb` is present:

```ts
if (payload.cb) {
  fetch(payload.cb, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'ayala-land-payment-link/1.0',
    },
    body: JSON.stringify({
      status: 'succeeded',
      invoiceNumber: payload.inv,
      amount: payload.amt,
      currency: 'PHP',
      paymentIntentId: paymentIntent.id,
      paymentId: ref.key,                      // RTDB push key
      payerEmail: effectiveEmail || undefined,
      payerName: effectiveName || undefined,
      sessionId: payload.sid || undefined,
      timestamp: new Date().toISOString(),
    }),
  }).catch(err => {
    console.error('External pay callback (success) failed:', err)
  })
  // Do NOT await; do NOT block the response.
}
```

Important: the user's 200 must not depend on the callback's success. Callback failure is logged but does not bubble.

### NEW endpoint — `POST /api/external/payment-link/notify-failure`

The form calls this when Stripe.confirmCardPayment returns an error, when the payment intent ends in a non-`succeeded` status, or when the server-side `confirm` returns non-2xx.

**Request body:**
```json
{ "token": "<jwt>", "errorMessage": "Your card was declined." }
```

**Behavior:**
1. Verify token. Reject 401 if invalid.
2. If `payload.cb` is absent, return `{ ok: true, dispatched: false }`.
3. Else fire-and-forget POST to `payload.cb`:
   ```json
   {
     "status": "failed",
     "invoiceNumber": "...",
     "amount": 12500,
     "errorMessage": "Your card was declined.",
     "sessionId": "...",
     "timestamp": "..."
   }
   ```
4. Return `{ ok: true, dispatched: true }` immediately.

**Errors:** 400 for missing token, 401 for invalid token, 500 for unexpected server errors. The endpoint never returns the chatbot's error to the user — failure to deliver the callback is logged server-side only.

## Page / Component Changes

### `app/src/app/pay/external/page.tsx`

- Header bar: `bg-[#0E2C20]` (was `#003B1F`).
- Show the logo (`<img src="/ali-access-logo.svg" />` at h-9 w-9 with white background and rounded corners) next to the wordmark "Ayala Land Access" in white, font-bold, tracking-tight.
- Page bg: `bg-[#F5EEDE]` (was `bg-slate-100`).
- Card: white bg (unchanged), border `border-[#DDD4C9]`.
- Card header: `bg-[#0E2C20]/5`, border-bottom `#DDD4C9`. Single-line "Payment Portal" heading in `text-[#0E2C20]`. **Subtitle removed.**
- Summary box: bg `#F5EEDE`/30, label text `#383D36`, value text `#0E2C20`.
- Inputs: border `#DDD4C9`, focus ring `#0E2C20/30`, focus border `#0E2C20`.
- "Continue to Card Payment" button: `bg-[#0E2C20]`, hover `#0E2C20/90`, white text.
- Footer: ShieldCheck icon `#0E2C20`, text `#383D36`.

### `app/src/components/pay/external/ExternalPaymentForm.tsx`

- CardElement options use `color: '#0E2C20'` for active, `#CE3106` for invalid.
- Card wrapper border: `#DDD4C9`.
- Pay button: `bg-[#0E2C20]`, hover `bg-[#0E2C20]/90`.
- Footer text: `text-[#383D36]/70`.
- **New behavior:** on every error path (Stripe error, non-succeeded paymentIntent, fetch network error to confirm, confirm `!res.ok`), call:
  ```ts
  fetch('/api/external/payment-link/notify-failure', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, errorMessage }),
  }).catch(() => {})
  ```
  Fire-and-forget. Do not block surfacing the error to the user.

### `app/src/app/pay/external/success/page.tsx`

- Page bg: `bg-[#F5EEDE]`.
- Header: same logo + wordmark as the main page.
- Card border: `#DDD4C9`.
- Heading "Payment Successful" in `text-[#0E2C20]`.
- Amount: `text-[#0E2C20]`.
- Subtitle/blurb: `text-[#383D36]`.
- Footer: same.

## File Manifest

### New
| Path                                                          | Purpose                                |
| ------------------------------------------------------------- | -------------------------------------- |
| `app/public/ali-access-logo.svg`                              | Logo asset (copied from ali-access)    |
| `app/src/app/api/external/payment-link/notify-failure/route.ts` | Failure-callback dispatcher            |

### Modified (additive)
| Path                                                              | Change                                                |
| ----------------------------------------------------------------- | ----------------------------------------------------- |
| `app/src/types/index.ts`                                          | Add `cb?: string` to `ExternalPayLinkPayload`         |
| `app/src/app/api/external/payment-link/route.ts`                  | Accept + validate `callbackUrl`, embed as `cb`        |
| `app/src/app/api/external/payment-link/verify/route.ts`           | Surface `callbackUrl` in response                     |
| `app/src/app/api/external/payment-link/confirm/route.ts`          | Fire success callback to `cb` after RTDB push         |
| `app/src/app/pay/external/page.tsx`                               | Reskin + drop subtitle                                |
| `app/src/app/pay/external/success/page.tsx`                       | Reskin                                                |
| `app/src/components/pay/external/ExternalPaymentForm.tsx`         | Reskin + call notify-failure on errors                |

### Untouched
- `globals.css`, `tailwind.config.ts`, `layout.tsx`
- The existing `/pay` flow and all sibling components
- Drizzle schema and Postgres tables
- The intent endpoint (no callback work needed there)

## Demo Walkthrough

```bash
# Chatbot mints a URL with a callback
curl -X POST https://mpe-collections-demo.vercel.app/api/external/payment-link \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 12500,
    "invoiceNumber": "EXT-2026-001",
    "customerName": "Maria Cruz",
    "payerEmail": "maria@example.com",
    "sessionId": "chatbot-sess-7Z",
    "callbackUrl": "https://webhook.site/abc-123"   ← chatbot's webhook
  }'
# → { url: "https://.../pay/external?token=...", expiresAt: "..." }

# User opens URL — sees Ayala Land Access branded page
# User pays with 4242 4242 4242 4242
# → On success: webhook.site receives:
#   POST { status: "succeeded", invoiceNumber: "EXT-2026-001", amount: 12500, ... }
# → On Stripe decline (use 4000 0000 0000 0002): webhook.site receives:
#   POST { status: "failed", errorMessage: "Your card was declined.", ... }
```

## Risks & Open Questions

- **Open callback target.** Anyone who gets hold of a token's `cb` could replay it via raw fetch. Mitigated by JWT signing the token, but the chatbot must still treat callbacks as untrusted-source events and verify their content against its own session record. Acceptable for demo.
- **Callback URL traversal.** A malicious mint caller could set `callbackUrl` to internal addresses (`http://localhost:80/admin`, `http://10.0.0.1/`, etc.) — server-side fetch would expose Vercel's egress to those URLs. Acceptable for an externally-deployed Vercel function (no useful internal network), but flagged. If this ever moves to a private env, add an allowlist.
- **Manrope font dropped.** Brand parity is ~95% without Manrope (Inter handles 100% of the visible text well). Adding Manrope is a one-line `next/font` import in this page only; can revisit if user wants exact parity.
- **Failure callback is best-effort from the browser.** If the user closes the tab during a Stripe error, the failure callback may not fire. The chatbot should still treat absence of a callback after `expiresAt` as "user abandoned" rather than a hard error.

## Out of Scope for This Spec

- HMAC-signing the callback POST (deferred until real integrations exist).
- Retrying failed callback deliveries (single fire-and-forget for demo).
- A "callback delivered" status field stored alongside the RTDB record.
- Promoting the failure callback into `incoming_payments_col` or any audit table.
