# Automated BIR 2307 Issuance — Ayala Land Collections Phase 2

**Date:** 2026-04-21
**Status:** Design approved by user; ready for implementation plan
**Audience for pitch:** Ayala Land Finance / AR leadership
**Decision sought from pitch:** Approval to add this module to the existing Searce Collections engagement (phase-2 scope expansion)

## Summary

Two deliverables:

1. A Searce-branded pptx proposal deck pitching a new Collections module that auto-issues BIR 2307 certificates on behalf of enrolled corporate tenants whenever a rent payment lands — regardless of payment rail.
2. A full demo implementation inside the existing `mpe-collections-demo` app that supports the deck with a live, reproducible "magic moment" and the supporting intelligence features (Gemini ATC classification, Gemini Vision OCR ingestion, escalations).

Build order: demo → screenshots → deck.

## Problem statement

Under PH tax rules (RR 11-2018), corporate tenants are statutory withholding agents on real-property rent and pay Ayala Land net of 5% CWT. The 2307 certificate that legally supports that short-payment is issued by the tenant, typically weeks after payment, often via email, mail, or courier — sometimes never.

Consequences for Ayala AR today:
- Invoices cannot close until the matching 2307 arrives; revenue sits in "paid-but-not-closed" limbo.
- Manual reconciliation of short-payments against eventual 2307s consumes AR staff time.
- Missing 2307s at year-end disallow the tax credit — cash loss to Ayala Land.

Globe's eCWT portal (`ecwt.globe.com.ph`) solves an analogous problem for telco billing by making the 2307 filing the payment channel itself — but requires the customer to do the filing in-portal. Ayala cannot force tenants to change how they pay rent; most pay via bank transfer outside any Ayala portal.

## Solution

A one-time tenant enrollment captures a durable authorization for Ayala's portal to generate, electronically sign, and deliver 2307s on the tenant's behalf. Thereafter, every incoming payment (any rail — bank transfer, check, Stripe, QR) triggers auto-issuance: the system detects the withholding gap, drafts the 2307, stamps the tenant's stored signature, posts the CWT as a reconciling payment, closes the invoice, and emails the certificate to the tenant.

Legal basis:
- **RA 8792** (E-Commerce Act) — electronic signatures are legally valid.
- **RR 16-2021 / RMC 29-2019** — BIR accepts system-generated and electronically signed 2307s, including those issued by agents under standing authorization.

Tenants who never enroll are still supported via a Gemini Vision OCR ingestion path: emailed 2307 PDFs are auto-extracted and matched to open invoices.

### Why this is different from Globe's eCWT

| | **Globe eCWT** | **Ayala Phase 2** |
|---|---|---|
| Industry | Telco billing | Real-estate leasing |
| Withholding rate | 2% on services | 5% on rent (ATC WC100) |
| Payment rail | In-portal only | **Any rail — bank, check, Stripe, QR** |
| Transaction source | MyBSS → ADH → portal | Invoice from Collections demo |
| Tenant action per 2307 | Preparer + Approver click | **One-time enrollment; zero per-payment** |
| 2307 signing | Stored signature on first approval | Stored signature at enrollment |
| Reconciliation | Portal posts payment to MyBSS | **Auto-close invoice on gap match** |
| Non-enrolled tenants | Not supported | **Gemini OCR + invoice match** |

## Deliverable A — Searce-branded pptx deck

**Location:** `~/projects/searce/ayalaland/decks/2026-04-21-cwt-automation-phase2.pptx`
**Generator:** `~/projects/searce/ayalaland/decks/build-deck.py` (uses python-pptx, invoked via the `pptx` skill)
**Audience:** Ayala Land Finance / AR leadership
**Length:** 10 slides
**Narrative arc:** Classic Pain → Solution → Demo → Ask

### Branding

Lifted from `~/projects/searce/indosat/presentation-remotion/src/theme.ts`:

- **Palette:** navy `#001630`, dark `#0C2656`, blue `#004596`, accent `#0064FF`, light `#E5EEFC`, gray50 `#f9fafb`, gray200 `#e5e7eb`, gray500 `#6b7280`, gray600 `#4b5563`. Tag chips use amber `#f59e0b`, green `#10b981`, rose `#f43f5e`, purple `#8b5cf6`.
- **Typography:** Manrope (Google-Font stand-in for Gilroy, matching the Indosat deck).
- **Chrome on every content slide:** top bar (Searce logo left, "Ayala Land · Collections Phase 2" breadcrumb center, uppercase section pill right), gradient accent stripe under the bar (blue → accent), bottom bar with "Searce · Proposal · April 2026" left and page number right.
- **Title slide:** full-bleed navy gradient, Searce wordmark top, large title center, accent stripe bottom.

Logo SVGs copied from `~/projects/searce/indosat/docs/saos/searce-logo.svg` and `searce-logo-white.svg` into the deck folder.

### Slide-by-slide outline

| # | Section pill | Headline | Body | Visual |
|---|---|---|---|---|
| 1 | — | Automated BIR 2307 Issuance · Ayala Land Collections Phase 2 · April 2026 · Searce | (title slide) | Navy gradient, Searce wordmark, accent stripe |
| 2 | Pain | Every peso you collect from a corporate tenant is already 5% short. | Corporate lessees are statutory withholding agents on rent. They pay net of 5%. The 2307 that makes the short-payment creditable arrives weeks later — or never. Until it arrives the invoice can't close and the BIR credit can't be claimed. | Illustration: ₱100K invoice → ₱95K cash in + ₱5K "???" with calendar showing weeks passing |
| 3 | Cost | The unreconciled AR that 2307s create. | Four stat tiles sourced live from seed data: % of B2B invoices affected; ₱ stuck in paid-but-not-closed; avg days aging waiting for 2307; ₱ annual BIR credit at risk if late. | Four stat cards in 2×2 grid |
| 4 | Solution | Stop waiting. Issue the 2307 yourself. | One-time tenant enrollment grants Ayala's portal durable authorization to generate, e-sign, and deliver 2307s. Every rent payment — any rail — triggers automatic issuance. Invoice closes the day cash lands. Legal basis: RA 8792 + RR 16-2021. | Three-step horizontal flow: Enroll once → Pay any rail → 2307 auto-issued |
| 5 | Precedent | Globe already does this. Here's what's different for Ayala. | Two-column comparison table (see above, with the eight rows). Bold rows show where Ayala's approach extends beyond Globe's playbook. | Side-by-side table, Globe left / Ayala right |
| 6 | Demo | Tenant enrolls once. | Walk-through of the enrollment screen (mirrors ecwt.globe.com.ph/sign-up): company info + TIN proof + signatory + signature + three declarations + durable authorization consent. | Screenshot `enrollment.png`, annotated with three callouts (TIN proof, signature, authorization) |
| 7 | Demo | 🎯 The magic moment. | Rent payment of ₱95,000 arrives → system detects gap against ₱100,000 invoice → auto-generates BIR 2307 with 15-digit ref, stamps stored signature, posts CWT, closes invoice, emails tenant. Zero AR clicks. | Three-panel filmstrip: (1) `magic-before.png` (payment notification), (2) `magic-pdf.png` (2307 PDF with signature), (3) `magic-after.png` (invoice CLOSED) |
| 8 | Intelligence | The AI that handles the messy edges. | Three cards: (a) Gemini classifies ATC codes on ambiguous contracts; (b) Gemini Vision OCRs emailed 2307s from non-enrolled tenants and matches to invoices; (c) anomaly queue for gaps that don't match declared rates, routed to AR with one-click resolution. | Three-column cards with icons; fourth panel shows `escalation.png` |
| 9 | Outcome | What your AR team gets. | Four outcome cards: near-zero DSO on CWT invoices; monthly QAP/alphalist CSV ready to upload; audit-ready 2307 archive per TIN; tenant self-service inbox. | Four outcome cards with accent-color left borders; embedded `ar-queue.png` |
| 10 | Ask | Add the Withholding Tax module to the Collections engagement. | Phase-2 scope box: 6-week delivery, re-uses existing schema + documents pipeline + Gemini stack. Three deliverables: enrollment portal, auto-issuance engine, AR QAP export. Next step: SOW amendment. | Roadmap bar: Phase-1 (done) → Phase-2 (proposed) with deliverable chips |

Every slide gets a speaker-notes block so the deck stands alone if forwarded.

## Deliverable B — Demo implementation (full scope)

Location: `~/projects/mpe-collections-demo/app`. Full scope (enrollment + auto-issuance + OCR + ATC classification + escalations + QAP export + magic-moment emulator).

### Schema delta

DDL pushed through the Supabase SQL proxy per `CLAUDE.md` conventions.

Add to `customers_col`:
- `tin varchar(15)`
- `branch_code varchar(5)`
- `rdo_code varchar(3)`
- `tax_classification varchar(20)` — `PRIVATE` / `GOVT`
- `is_top_withholding_agent boolean default false`
- `authorized_signatory_name varchar(200)`
- `authorized_signatory_email varchar(200)`
- `signature_image_url text`
- `withholding_rate_pct decimal(5,2) default 5.00`
- `cwt_atc_code varchar(10) default 'WC100'`
- `cwt_auto_issue_enrolled_at timestamp`
- `cwt_authorization_document_id integer` — FK → `documents_col`

Add to `incoming_payments_col`:
- `cwt_amount decimal(12,2)`
- `cwt_certificate_id integer` — FK → `cwt_certificates_col`

New table `cwt_certificates_col`:
- `certificate_id serial pk`
- `customer_id`, `contract_id`, `invoice_id`, `payment_id` — FKs
- `gross_amount decimal(12,2)`
- `withheld_amount decimal(12,2)`
- `rate_pct decimal(5,2)`
- `atc_code varchar(10)`
- `period_start date`, `period_end date`
- `reference_number varchar(15) unique`
- `pdf_url text`
- `signature_applied boolean default false`
- `status varchar(20)` — `DRAFT | ISSUED | REVOKED | ESCALATED`
- `source varchar(20)` — `AUTO_ENROLLED | OCR_INGESTED | MANUAL`
- `signed_by_name`, `signed_by_email`
- `issued_at timestamp`
- `created_at timestamp default now()`
- indexes on `customer_id`, `invoice_id`, `status`, `issued_at`

### Core flows

**Flow 1: Tenant enrollment** (`/pay/enroll` → `POST /api/cwt/enroll`)
Single-page form mirroring `ecwt.globe.com.ph/sign-up`. Server creates/updates customer record, writes `documents_col` rows for TIN proof + signature PNG + signed authorization letter, timestamps `cwt_auto_issue_enrolled_at`.

**Flow 2: Auto-issuance on payment** (inline trigger from payment creation + nightly cron sweep)
```
for payment in un-processed incoming_payments:
  invoice   = payment.invoice
  customer  = payment.customer
  if customer.cwt_auto_issue_enrolled_at is null: skip
  expected_gap = invoice.amount × customer.withholding_rate_pct / 100
  actual_gap   = invoice.balance_remaining − payment.amount
  if |actual_gap − expected_gap| / invoice.amount < 0.005:
    create cwt_certificate, status = DRAFT
    render 2307 PDF, stamp signature, save to storage
    flip status = ISSUED
    patch payment row (cwt_amount, cwt_certificate_id)
    insert synthetic CWT incoming_payment (method='CWT', amount=expected_gap)
    close invoice
    email tenant
  elif rate declared but gap mismatches:
    create escalation of type CWT_GAP_MISMATCH
```

**Flow 3: Inbound 2307 OCR ingestion** (`/api/cwt/ingest-ocr`)
Reuses existing Gemini Vision pipeline (`/lib/ml-local.ts` patterns). Gemini extracts: withholder TIN, withheld amount, period, ATC. Matcher finds candidate invoices by TIN + period + amount. Unique match → create certificate with `source = OCR_INGESTED`, post CWT payment, close invoice. Ambiguous match → escalation type `CWT_OCR_AMBIGUOUS`.

**Flow 4: Gemini ATC classification** (`/api/cwt/classify-atc`)
Called at enrollment or when a contract's type/tenant classification is ambiguous. Gemini reads the contract description and tenant profile → returns ATC code + confidence. Below threshold → AR confirms.

**Flow 5: Escalations**
Piggyback on existing `escalations_col`. Two new escalation types: `CWT_GAP_MISMATCH`, `CWT_OCR_AMBIGUOUS`.

**Flow 6: QAP/alphalist export** (`/api/reports/qap`)
CSV generator consolidating `cwt_certificates_col` rows per `atc_code` per period. Matches BIR QAP schedule columns.

### File layout

```
app/src/
├─ app/
│  ├─ pay/
│  │  ├─ enroll/page.tsx              [NEW]
│  │  └─ enroll/success/page.tsx      [NEW]
│  ├─ collections/
│  │  └─ cwt/
│  │     ├─ page.tsx                  [NEW]
│  │     └─ [id]/page.tsx             [NEW]
│  ├─ receivable/[id]/page.tsx        [MODIFY]
│  └─ api/
│     ├─ cwt/
│     │  ├─ enroll/route.ts           [NEW]
│     │  ├─ generate/route.ts         [NEW]
│     │  ├─ sign/route.ts             [NEW]
│     │  ├─ ingest-ocr/route.ts       [NEW]
│     │  └─ classify-atc/route.ts     [NEW]
│     ├─ cron/generate-cwt/route.ts   [NEW]
│     ├─ demo/simulate-cwt-payment/route.ts [NEW]
│     └─ reports/qap/route.ts         [NEW]
├─ components/
│  └─ cwt/
│     ├─ EnrollmentForm.tsx           [NEW]
│     ├─ SignaturePad.tsx             [NEW]
│     ├─ CertificateCard.tsx          [NEW]
│     ├─ CertificateQueue.tsx         [NEW]
│     └─ Bir2307Preview.tsx           [NEW]
├─ lib/cwt/
│  ├─ pdf.ts                          [NEW]
│  ├─ pdf-fields.ts                   [NEW, generated]
│  ├─ reference.ts                    [NEW]
│  ├─ rates.ts                        [NEW]
│  ├─ detector.ts                     [NEW]
│  ├─ classifier.ts                   [NEW]
│  ├─ ocr.ts                          [NEW]
│  └─ qap.ts                          [NEW]
├─ db/schema.ts                       [MODIFY]
└─ lib/seed.ts                        [MODIFY]

app/public/forms/
└─ BIR-2307-fillable.pdf              [NEW asset — official BIR form]

app/public/signatures/
└─ demo-sig-{1..8}.png                [NEW, generated at build]

scripts/
├─ extract-2307-fields.ts             [NEW, one-shot]
└─ generate-signatures.ts             [NEW, one-shot]

vercel.json                           [MODIFY — add cron entry]
```

### BIR 2307 PDF rendering

Option A (chosen): fill the official BIR fillable 2307 PDF with `pdf-lib`.
- Template at `/app/public/forms/BIR-2307-fillable.pdf`.
- One-time `scripts/extract-2307-fields.ts` maps AcroForm field names to variables, writes `app/src/lib/cwt/pdf-fields.ts`.
- Signature stamping: `signature_image_url` drawn at the signatory-box coordinates, scaled to fit, with typed name + date beside it.
- Fallback: programmatic `drawText`/`drawImage` renderer behind a feature flag; engaged only if template PDF is missing.

### Reference number format

15-digit deterministic string, matching the eCWT format:
`YYYYMM + 9-digit zero-padded sha1-hash-trunc(customer_id + invoice_id + payment_id)`
Guaranteed unique via DB unique index; retry with increment on collision.

### Seed data plan

Out of the existing 30 seeded tenants, upgrade 11 to corporate lessees with CWT obligations:

| Bucket | Count | Purpose |
|---|---|---|
| Enrolled + healthy | 6 | Populate slides + stats; 6 months of auto-issued 2307s each |
| Enrolled + about-to-pay | 1 | Reserved for the live magic-moment demo; one open invoice, no payment yet |
| Enrolled + anomaly | 1 | Pre-seeded short-by-7% payment → ESCALATED certificate |
| Non-enrolled + emails a 2307 | 2 | OCR demo path |
| Non-enrolled + never files | 1 | Feeds "cost of pain" stat on slide 3 |

TINs, branch codes, RDO codes, signatory names generated deterministically from `seed=42` so screenshots stay stable.

**Signature generation** — `scripts/generate-signatures.ts` uses Satori + "Caveat" handwriting font + sharp to produce `demo-sig-{1..8}.png`, one per seeded signatory.

**Invoice/payment history** — 6 months back, each enrolled tenant has a clean run of net-of-5% payments already paired with ISSUED certificates. Slide-3 stats are computed live from this data, not hardcoded.

### Live magic-moment choreography

Add a "Simulate: corporate tenant pays rent (net of CWT)" button to the existing emulator (Redux `emulator` slice, `/components/emulator/`).

Presenter on stage, AR dashboard open at `/collections/cwt`:

| t | Event |
|---|---|
| 0.0 s | Presenter clicks the button |
| 0.5 s | Toast: *"Bank transfer received — ABC Corp · ₱95,000"* |
| 1.5 s | Toast: *"CWT gap detected: ₱5,000 @ 5.00% · ATC WC100"* — row animates into queue with status = DRAFT |
| 2.5 s | Toast: *"BIR 2307 rendered · ref 202604000001234"* — status flips DRAFT → ISSUED with pulse |
| 3.5 s | Toast: *"Invoice INV-000481 closed · tenant notified"* — invoice card in background greys to CLOSED |
| after | Presenter clicks the row → PDF preview modal shows the filled 2307 with signature |
| after | Presenter clicks "Tenant inbox preview" → mocked Gmail-style card shows the 2307 email "delivered" |

Total theatre: ~5 seconds, zero presenter typing.

All backed by a single endpoint `POST /api/demo/simulate-cwt-payment` that writes the `incoming_payments_col` row with the 5% gap against the reserved tenant, triggers the same production auto-issuance path, and returns a payload with toast copy and timings.

**Reset button** on the emulator panel rewinds the reserved tenant's state so the demo can run repeatedly in the same session.

### Screenshot capture for the deck

`build-deck.py` pipeline (run once before pptx generation):

1. Boot dev server on `:3000` as subprocess.
2. `POST /api/seed` (idempotent).
3. Playwright captures at `1440×900`:
   - `enrollment.png` → `/pay/enroll` (slide 6)
   - `magic-before.png` → `/collections/cwt` pre-simulation (slide 7 panel 1)
   - `magic-pdf.png` → 2307 PDF modal (slide 7 panel 2)
   - `magic-after.png` → `/receivable/[id]` with CLOSED badge (slide 7 panel 3)
   - `ar-queue.png` → `/collections/cwt` populated (slide 9)
   - `escalation.png` → `/collections/escalations` with a CWT_GAP_MISMATCH row (slide 8)
4. Reset emulator state.
5. Kill dev server.
6. Generate pptx embedding the PNGs.

Re-runnable end-to-end by `python build-deck.py`.

## Testing & verification

- Schema push verified via `\d+ cwt_certificates_col` through the SQL proxy.
- Unit tests around `detector.ts` (gap classification), `reference.ts` (uniqueness), `rates.ts` (ATC table lookup).
- Manual: run `npm run dev`, enroll a tenant through `/pay/enroll`, hit the emulator simulate button, verify the full 5-second choreography on screen.
- Manual: upload a sample emailed 2307 PDF via the ingest path, verify OCR extraction and invoice match.
- Manual: trigger a payment with a mismatched rate, verify escalation appears at `/collections/escalations`.
- Screenshot pipeline: `python build-deck.py` on a clean checkout produces the deck without intervention.

## Out of scope

- Real SES / email delivery — demo uses mocked inbox UI.
- Actual BIR eFPS / QAP upload integration — demo exports CSV, doesn't submit.
- Production-grade e-signature ceremony (DocuSign / PKI) — stored-signature-PNG stamping is sufficient for the demo.
- Multi-approver workflow per 2307 — pre-authorization is treated as blanket for the demo.
- Per-tenant rate overrides at the contract level — demo uses per-customer declared rate only.
- Production auth for the tenant enrollment route — reuses existing Firebase Google sign-in.

## Open questions

None blocking. One-off at build time: confirm the BIR 2307 fillable PDF to ship as the template (official form from `bir.gov.ph`).

## Sign-off

- [x] Design approved by user (all 5 sections, 2026-04-21)
- [ ] Spec reviewed by user
- [ ] Implementation plan written (via writing-plans skill)
