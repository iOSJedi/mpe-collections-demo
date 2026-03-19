# Design Spec: Penalty Breakdown, AP Supplier Workflow, Document AI Viewer

**Date:** 2026-03-19
**Status:** Approved
**Audience:** Internal Ayala Land stakeholders, client pitch demos

## Overview

Three feature enhancements to the Collections & Payments Portal that add visibility into penalty accrual and payment application, a demonstrable supplier payment workflow with approval timeline, and a side-by-side document viewer with AI analysis.

## Feature 1: Penalty & Payment Breakdown

### Goal

When a payer is multiple months overdue, the system should show a clear breakdown of principal vs. penalties per invoice, how payments are applied, and what remains outstanding. Both the Ayala Land admin and the payer should have full visibility.

### Data Model

#### New table: `penalty_config_col`

Global penalty settings (single row, enforced at the application layer via upsert on configId=1).

| Column | Type | Default | Notes |
|--------|------|---------|-------|
| configId | serial | PK | |
| penaltyRatePercent | numeric | 2.0 | Percentage per period |
| penaltyFrequency | varchar | 'MONTHLY' | Accrual frequency |
| applicationMethod | varchar | 'PENALTIES_FIRST' | 'PENALTIES_FIRST' or 'FIFO' |
| gracePeriodDays | integer | 0 | Days after due date before penalties accrue |
| updatedAt | timestamp | now() | |

#### New table: `penalty_ledger_col`

One row per invoice per overdue period.

| Column | Type | Notes |
|--------|------|-------|
| penaltyId | serial | PK |
| invoiceId | integer | FK → invoices_col |
| periodLabel | varchar | 'Month 1', 'Month 2', etc. |
| penaltyAmount | numeric | Rate × principal at time of accrual |
| penaltyRate | numeric | Snapshot of rate when accrued |
| accrualDate | date | When this penalty was calculated |
| status | varchar | 'ACTIVE', 'PAID', 'WAIVED' |
| paidAmount | numeric | Default 0; updated when payment applied |
| createdAt | timestamp | Default now() |
| updatedAt | timestamp | Updated when status or paidAmount changes |

#### New table: `payment_allocations_col`

Records how each payment was split across invoices and penalties.

| Column | Type | Notes |
|--------|------|-------|
| allocationId | serial | PK |
| paymentId | integer | FK → incoming_payments_col |
| invoiceId | integer | FK → invoices_col |
| penaltyId | integer | FK → penalty_ledger_col (nullable) |
| allocationType | varchar | 'PRINCIPAL' or 'PENALTY' |
| amount | numeric | |
| createdAt | timestamp | |

#### Modified: `invoices_col`

| New Column | Type | Default | Notes |
|------------|------|---------|-------|
| totalPenalties | numeric | 0 | Denormalized sum from penalty_ledger_col |
| penaltiesPaid | numeric | 0 | Denormalized sum of paid penalties |

Source of truth remains `penalty_ledger_col`. These columns are for fast queries.

#### Modified: `incoming_payments_col`

| Change | Notes |
|--------|-------|
| `invoiceId` | Make nullable. Payment-to-invoice mapping now lives in `payment_allocations_col`. For legacy/simple payments, `invoiceId` can still be set. For multi-invoice allocations (penalty-first across invoices), it should be null and the allocation table is the source of truth. |

### Payment Application Logic

Two configurable methods, default is **Penalties First** (landlord-friendly):

**Penalties First:**
1. Sum all ACTIVE penalties across all overdue invoices (oldest first)
2. Apply payment to penalties first (oldest invoice penalties first)
3. Remaining payment applied to principal (oldest invoice first)
4. Update penalty_ledger_col statuses and paidAmount
5. Update invoice balanceRemaining, totalPenalties, penaltiesPaid
6. Write allocation rows to payment_allocations_col

**FIFO (Oldest First):**
1. Start with oldest overdue invoice
2. Apply payment to that invoice's penalties, then principal
3. If invoice fully paid, move to next oldest
4. Same bookkeeping as above

### UI: Admin View (Customer Detail Page)

The current flat invoices table on `/receivable/[id]` is replaced with a breakdown view:

- Each invoice shown as a card with: aging badge (90+ DAYS OVERDUE / 60 DAYS / 30 DAYS / PENDING), invoice number, billing period
- Four columns per invoice: Principal, Penalty (with calculation shown, e.g., "3 months × 2%"), Paid, Balance
- Color-coded: red for 90+ days, amber for 30-60, blue for pending
- Summary bar at bottom: Total Principal, Total Penalties, Total Paid, Grand Total Due
- Payment history section enhanced to show allocation detail per payment: which invoice, allocation type (PRINCIPAL/PENALTY), amount. Shows "→ INV-XXXX fully settled" when an invoice is cleared.

### UI: Payer Portal (Enhanced /pay)

**Step 1 — Balance Breakdown:** After QR scan, payer sees all outstanding invoices grouped by month with principal and penalty subtotals per invoice. Total amount due shown prominently with principal/penalty split.

**Step 2 — Partial Payment Calculator:** When payer selects "Partial Payment" and enters an amount:
- "How your payment will be applied" section shows which penalties and principals will be covered (green, checkmark)
- "Still outstanding" section shows what remains (red, warning)
- Warning message: "Remaining balance of ₱X will continue to accrue penalties at Y%/month (≈₱Z/month)"
- Calculation updates dynamically as the payer changes the amount (client-side approximation for instant feedback; `/api/pay/preview` called on debounce ~500ms for server-validated breakdown)

### UI: Settings Panel

Added to existing settings sidebar:
- Penalty Rate (% per month) — numeric input
- Grace Period (days after due date) — numeric input
- Payment Application Method — toggle between "Penalties First (Landlord-friendly)" and "FIFO / Oldest First (Payer-friendly)"
- Save button

### API Routes

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/penalty-config` | GET | Fetch current penalty config |
| `/api/penalty-config` | PUT | Update penalty config |
| `/api/receivable/[id]/breakdown` | GET | Invoice breakdown with penalties and allocations for a customer |
| `/api/pay/preview` | POST | Calculate payment application preview (for "what if" calculator, no DB write) |
| `/api/pay/confirm` | POST | Enhanced: creates allocation records and updates penalty ledger |

### Seeding

`seedDatabase()` updated to:
- Create default penalty_config_col row (2%, monthly, penalties-first, 0 grace days)
- Generate penalty_ledger_col entries for overdue invoices based on months overdue
- Generate payment_allocations_col entries for existing payments
- Update denormalized penalty totals on invoices

---

## Feature 2: AP Supplier Payment Workflow

### Goal

Demonstrate the full lifecycle of a supplier payment — from claim submission through two-level approval to payment release — with a timeline UI showing every step. The emulator sidebar acts as the supplier simulator.

### Data Model

#### New table: `ap_workflow_events_col`

One row per lifecycle event per purchase order.

| Column | Type | Notes |
|--------|------|-------|
| eventId | serial | PK |
| supplierInvoiceId | integer | FK → supplier_invoices_col |
| poId | integer | FK → purchase_orders_col |
| eventType | varchar | See event types below |
| eventData | jsonb | Flexible payload (amounts, document refs, match results) |
| performedBy | varchar | User email or supplier name |
| notes | text | Nullable, free-text notes |
| createdAt | timestamp | |

**Event types:** `CLAIM_SUBMITTED`, `DELIVERY_REPORT_UPLOADED`, `GR_CONFIRMED`, `INVOICE_SUBMITTED`, `THREE_WAY_MATCH`, `AP_CLERK_APPROVED`, `AP_CLERK_REJECTED`, `FM_APPROVED`, `FM_REJECTED`, `PAYMENT_SCHEDULED`, `PAYMENT_RELEASED`

#### Modified: `supplier_invoices_col`

| New Column | Type | Notes |
|------------|------|-------|
| workflowStatus | varchar | 'SUBMITTED', 'GR_CONFIRMED', 'MATCHED', 'PENDING_AP_REVIEW', 'AP_APPROVED', 'PENDING_FM_REVIEW', 'FM_APPROVED', 'REJECTED', 'PAYMENT_SCHEDULED', 'RELEASED' |
| claimDocumentUrl | text | Base64 data URI of uploaded claim document |

### Approval Flow

Two-level approval:

1. **Supplier** submits claim/invoice and uploads delivery report (via emulator)
2. **System** confirms goods receipt and runs 3-way match (PO ↔ GR ↔ Invoice)
3. **AP Clerk** reviews documents and matching, approves or rejects
4. **Finance Manager** authorizes payment or returns to AP
5. **System** schedules and releases payment

Rejection at any approval step sets `workflowStatus` to `'REJECTED'` with notes. The supplier can re-submit by creating a new claim against the same PO (the original rejected claim is preserved for audit). The timeline records every transition including rejections.

### UI: Emulator — Supplier Mode

The existing emulator sidebar gets a **Payer / Supplier** mode toggle at the top:

- **Supplier selector**: dropdown of seeded suppliers (fetched from existing `GET /api/payable` which returns supplier data)
- **PO selector**: dropdown of purchase orders for selected supplier
- **Actions**:
  - Submit Claim / Invoice — creates supplier invoice record, fires CLAIM_SUBMITTED event
  - Upload Delivery Report — attaches document, fires DELIVERY_REPORT_UPLOADED event
  - Check Payment Status — opens timeline view for selected PO
- **Recent Submissions**: list of supplier's recent claims with workflow status badges

### UI: AP Approval Queue

New view at `/payable/approvals` (or tab within existing payable pages):

- **Tabs**: "Pending My Review", "All Claims", "Released"
- Each claim card shows:
  - Supplier invoice number, supplier name
  - Amount, linked PO number
  - GR verification status, 3-way match status
  - Current workflow status badge
  - Submission date / last approval date
- **Role-based actions**:
  - AP Clerk sees: Approve, Reject, View Documents, View Timeline
  - Finance Manager sees: Authorize Payment, Return to AP, View Timeline
- For the demo, role is simulated (no actual RBAC) — a toggle or the current user context determines which actions appear

### UI: Payment Lifecycle Timeline

Vertical timeline component, reusable across the app:

- Each event from `ap_workflow_events_col` renders as a step
- **Completed steps**: green dot, event description, performer, timestamp
- **Current step**: amber dot with glow, "Waiting since..." label
- **Future steps**: grey dot, dimmed text showing what's next
- Vertical line gradient: green → amber → grey
- Accessible from:
  - Approval queue → "View Timeline" button
  - Emulator → "Check Payment Status" action
  - Payable detail page `/payable/[id]`

### API Routes

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/payable/claims` | GET | List claims with filtering by status, supplier |
| `/api/payable/claims` | POST | Submit new claim (supplier action via emulator) |
| `/api/payable/claims/[id]/upload` | POST | Upload delivery report |
| `/api/payable/claims/[id]/approve` | POST | AP Clerk or FM approval action |
| `/api/payable/claims/[id]/reject` | POST | Rejection with notes |
| `/api/payable/claims/[id]/timeline` | GET | Fetch all workflow events for a supplier invoice (joins via supplierInvoiceId) |

`[id]` in all `/api/payable/claims/[id]/*` routes refers to `supplierInvoiceId`.

### Seeding

`seedDatabase()` updated to:
- Set workflowStatus on existing supplier invoices (mix of statuses across the pipeline)
- Generate ap_workflow_events_col entries for each supplier invoice based on its status (e.g., a RELEASED invoice gets all 8 events with realistic timestamps; a PENDING_REVIEW one gets only the first 2-3)

---

## Feature 3: Document Upload with AI Analysis Viewer

### Goal

Show uploaded payment documents (deposit slips, delivery reports) alongside the AI-extracted fields in a side-by-side view, with match/mismatch indicators and confidence scoring.

### Data Model

No schema changes. Uses existing `documents_col` table which already stores:
- `fileUrl` (text — base64 data URI for uploaded files, URL string for seeded placeholder data)
- `ocrResult` (jsonb with extracted fields)
- `validationResult` (jsonb with match/mismatch details)
- `ocrStatus` (varchar — 'PENDING', 'COMPLETED', etc.)

Verification status (verified/rejected) is derived from the `validationResult` jsonb content, not a separate status column.

### UI: Side-by-Side Document Viewer

A reusable panel/modal component with two columns:

**Left column — Document:**
- Rendered image of the uploaded document (deposit slip, delivery report)
- For uploaded deposit slips rendered as images, no pixel-level highlights (Gemini doesn't return coordinates). Instead, the left column displays the image with extracted field values listed as an overlay legend below the image, visually keyed by color to the right column's field cards.
- Zoom and download controls

**Right column — AI Analysis:**
- Overall confidence score (large number, color-coded: green ≥ 85%, amber 60-85%, red < 60%)
- Each extracted field as a card:
  - Field name (Amount, Date, Depositor, Bank, Reference)
  - Extracted value (bold)
  - Match indicator: green dot + "Match", red dot + "Mismatch", blue dot + "New"
  - For mismatches: explanation text (e.g., "Expected ₱53,000 — deposit is ₱3,000 short")
- Action buttons:
  - All match: "Confirm Payment" (green) + "Flag for Review"
  - Mismatch found: "Accept as Partial" (amber) + "Escalate" (red)

### Mismatch Scenarios

The viewer handles these mismatch types:
- **Amount mismatch**: Deposit amount ≠ expected payment amount. Shows difference and possible explanation (e.g., "missing penalty amount").
- **Name mismatch**: Depositor name ≠ customer name. Flags as possible third-party deposit.
- **Date mismatch**: Deposit date significantly different from payment record date.
- **Bank mismatch**: Different bank than expected receiving account.

### Access Points

The same viewer component is used from three locations:
1. **Customer Detail** (`/receivable/[id]`) — "View Document" link in payment history rows
2. **Collections Verification** (`/collections`) — document verification screen
3. **AP Approval Queue** (`/payable/approvals`) — "View Documents" button on supplier claims (for delivery reports)

### API Routes

No new routes needed. Existing endpoints already return document data:
- `GET /api/documents/[id]` — returns document with OCR and validation results
- `POST /api/documents` — upload and process (already exists)

The enhancement is purely in the frontend rendering of data that already exists in the API responses.

---

## Cross-Cutting Concerns

### Seeding Updates

The seed function (`/app/src/lib/seed.ts`) needs these additions:
- Default penalty config row
- Penalty ledger entries for overdue invoices (calculated from existing overdue seed data)
- Payment allocation records for existing seeded payments
- AP workflow events for existing supplier invoices at various stages
- Workflow status on supplier invoices

### Emulator Enhancements

The emulator Redux slice (`emulatorSlice`) and component need:
- Mode state: 'payer' | 'supplier'
- Supplier selection state
- PO selection state
- Actions that call the new AP claim APIs

### No Authentication Changes

All new routes use the existing `withAuth()` middleware, **except** routes under `/api/pay/*` which remain unauthenticated (QR token-based access for payers, as in the current implementation). Role-based actions (AP Clerk vs FM) are simulated for the demo — no new auth roles needed.
