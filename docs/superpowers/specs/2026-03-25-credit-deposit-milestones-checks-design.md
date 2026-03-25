# Design Spec: Credit/Overpayment, Security Deposit Forfeiture, Milestone Payments, Check Payments

**Date:** 2026-03-25
**Status:** Approved
**Audience:** Internal Ayala Land stakeholders, client pitch demos

## Overview

Four business logic enhancements: (1) credit wallet for overpayments on the AR side, (2) security deposit forfeiture with auto-flagging and approval on the AR side, (3) milestone-based payment schedules on the AP side, and (4) check payment method with clearing period on the AR side.

---

## Feature 1: Credit Balance & Overpayment (AR)

### Goal

When a tenant overpays, the excess is stored as a credit balance on their account. Admins can apply credits to future invoices or issue refunds.

### Data Model

#### New table: `credit_ledger_col`

| Column | Type | Notes |
|--------|------|-------|
| entryId | serial | PK |
| customerId | integer | FK → customers_col |
| type | varchar | 'CREDIT' (overpayment in), 'DEBIT' (applied to invoice), 'REFUND' |
| amount | numeric | Always positive; type determines direction |
| description | text | e.g., "Overpayment on INV-2026-0201" |
| paymentId | integer | FK → incoming_payments_col (nullable, source payment for CREDIT) |
| invoiceId | integer | FK → invoices_col (nullable, target invoice for DEBIT) |
| createdAt | timestamp | |

#### Modified: `customers_col`

| New Column | Type | Default | Notes |
|------------|------|---------|-------|
| creditBalance | decimal(12,2) | 0 | Denormalized. Source of truth is credit_ledger_col (sum of CREDIT - DEBIT - REFUND) |

### `calculateAllocation()` Enhancement

The existing `calculateAllocation()` function in `/app/src/lib/payment-allocation.ts` must be extended to return an `excessAmount` field in the `AllocationPreview` response. Currently, the function tracks leftover payment in a local `remaining` variable but only uses it for `totalApplied`. The new field:

```typescript
// Add to AllocationPreview type
excessAmount: number  // payment amount minus total applied (> 0 if overpayment)
```

Computed as: `Math.max(0, paymentAmount - totalApplied)`.

### Payment Flow Enhancement

The existing `POST /api/pay/confirm` route is enhanced:

1. Run `calculateAllocation()` as before
2. Check `allocation.excessAmount > 0` (overpayment detected):
   - Apply full amount to all outstanding items
   - Excess amount → insert a CREDIT row in `credit_ledger_col`
   - Update `customers_col.creditBalance`
3. Response includes `creditCreated: { amount, newBalance }` if applicable

### UI: Customer Detail — Credit Balance Card

New card in the customer detail sidebar:
- Large credit balance amount (blue themed)
- Source description ("From overpayment on INV-2026-0201")
- "Apply to Invoice" button → opens dialog listing outstanding invoices, admin selects one, credit is applied (creates DEBIT entry, reduces invoice balance)
- "Refund" button → creates REFUND entry, reduces credit balance
- Credit history log showing all entries (CREDIT/DEBIT/REFUND with timestamps)

### API Routes

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/credit/[customerId]` | GET | Get credit balance and ledger history |
| `/api/credit/[customerId]/apply` | POST | Apply credit to an invoice. Body: `{ invoiceId, amount }` |
| `/api/credit/[customerId]/refund` | POST | Issue refund. Body: `{ amount }` |

All routes use `verifyToken` directly (dynamic `[customerId]` param).

### Seeding

- 2-3 customers seeded with credit balances from overpayments
- Credit ledger entries showing the overpayment CREDIT and optionally a DEBIT (partial application)

---

## Feature 2: Security Deposit Forfeiture (AR)

### Goal

When a tenant fails to pay, the system auto-flags overdue invoices for security deposit deduction after a configurable threshold (default 90 days). An admin must approve before the deduction executes.

### Data Model

#### New table: `security_deposits_col`

| Column | Type | Notes |
|--------|------|-------|
| depositId | serial | PK |
| customerId | integer | FK → customers_col (unique constraint) |
| contractId | integer | FK → contracts_col |
| initialAmount | numeric | Original deposit amount |
| currentBalance | numeric | Decreases on approved forfeitures |
| createdAt | timestamp | |

#### New table: `deposit_forfeitures_col`

| Column | Type | Notes |
|--------|------|-------|
| forfeitureId | serial | PK |
| depositId | integer | FK → security_deposits_col |
| customerId | integer | FK → customers_col (denormalized for query convenience) |
| invoiceId | integer | FK → invoices_col |
| amount | numeric | Amount to deduct |
| status | varchar | 'FLAGGED', 'APPROVED', 'REJECTED' |
| flaggedAt | timestamp | When auto-flagged or manually created |
| reviewedBy | varchar | Admin email (nullable) |
| reviewedAt | timestamp | (nullable) |
| notes | text | (nullable) |

#### Modified: `invoices_col`

| New Column | Type | Notes |
|------------|------|-------|
| depositForfeitureFlag | varchar | null, 'FLAGGED', 'FORFEITED' |

#### Modified: `penalty_config_col`

| New Column | Type | Default | Notes |
|------------|------|---------|-------|
| depositForfeitDays | integer | 90 | Days overdue before auto-flagging |

### Auto-Flag Logic

During seed (and potentially a cron job):
- For each overdue invoice where `daysOverdue >= depositForfeitDays`:
  - Check if customer has a security deposit with `currentBalance > 0`
  - Check if this invoice doesn't already have a forfeiture entry
  - If both true: create a FLAGGED forfeiture entry, set invoice `depositForfeitureFlag = 'FLAGGED'`

### UI: Customer Detail — Security Deposit Card

New card in customer detail sidebar (alongside Credit Balance):
- Shows Initial / Current / Forfeited amounts
- Forfeiture history log: each entry shows amount, invoice, status (APPROVED/FLAGGED), date, reviewer
- "Apply from Deposit" manual action button for creating a forfeiture without waiting for auto-flag

### UI: Deposit Forfeiture Approval Queue

New section in Collections (tab or separate page):
- Tabs: "Pending Approval", "Approved", "Rejected"
- Each card shows: customer name, property, invoice number, amount, days overdue, deposit balance
- Actions: "Approve Forfeiture", "Reject", "Manual Amount" (override the deduction amount)
- On approve: status → APPROVED, deposit `currentBalance` reduced, invoice marked FORFEITED or balance reduced

### UI: Settings

Add to existing penalty configuration panel:
- "Auto-flag after (days overdue)" — numeric input, default 90

### API Routes

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/deposits/[customerId]` | GET | Get deposit info and forfeiture history |
| `/api/forfeitures` | GET | List all forfeitures with filtering by status |
| `/api/forfeitures/[id]/approve` | POST | Approve a forfeiture. Body: `{ amount?, notes? }` |
| `/api/forfeitures/[id]/reject` | POST | Reject a forfeiture. Body: `{ notes }` |

Routes with `[id]` or `[customerId]` use `verifyToken` directly. The list route uses `withAuth`.

### Seeding

4 demo scenarios (relative to demo date 2026-03-25):
1. **Already forfeited:** Customer with ₱150k deposit, ₱50k approved & deducted for Oct 2025 invoice (150+ days overdue, well past threshold)
2. **Pending approval:** Same customer, Dec 2025 invoice flagged at 100 days overdue (past 90-day threshold), awaiting admin review
3. **Near threshold:** Another customer with Jan 2026 invoice at 69 days overdue — not yet flagged, approaching 90-day threshold
4. **Deposit exhausted:** Customer whose deposit has been fully forfeited across multiple invoices (balance = ₱0)

---

## Feature 3: Milestone-Based Payments (AP)

### Goal

Purchase orders can have milestone-based payment schedules (e.g., 20% initial, 40% delivery, 40% completion). Templates provide preset schedules; milestones are editable per PO. Clear visualization of progress and payment status.

### Data Model

#### New table: `milestone_templates_col`

| Column | Type | Notes |
|--------|------|-------|
| templateId | serial | PK |
| name | varchar | "Standard 20/40/40", "Equal Split 50/50", etc. |
| milestones | jsonb | Array of `{ label: string, percentage: number }` |
| createdAt | timestamp | |

#### New table: `po_milestones_col`

| Column | Type | Notes |
|--------|------|-------|
| milestoneId | serial | PK |
| poId | integer | FK → purchase_orders_col |
| label | varchar | "Initial Delivery", "Upon Delivery", "Completion" |
| percentage | numeric | e.g., 20.00 |
| amount | numeric | Calculated: PO total × percentage / 100 |
| status | varchar | 'PENDING', 'COMPLETED', 'PAID' |
| completedAt | timestamp | When milestone was marked complete (nullable) |
| paidAt | timestamp | When payment was released (nullable) |
| paymentReference | varchar | Reference number for the payment (nullable) |
| sortOrder | integer | Display order |
| createdAt | timestamp | |

### UI: Milestone Templates

Settings or Payables config page showing:
- List of preset templates with color-coded percentage bars
- Each template shows name and milestone breakdown
- "New Template" button for creating custom schedules
- Seeded templates: "Standard 20/40/40", "Equal Split 50/50", "Full on Completion"

### UI: PO Detail — Milestone Progress

On the payable detail page (`/payable/[id]`), each PO with milestones shows:
- Template name reference
- Stacked progress bar: green (PAID), amber (COMPLETED awaiting payment), grey (PENDING)
- Each milestone as a card with left color border:
  - Green border + "PAID" badge: completed and paid, shows payment reference and date
  - Amber border + "COMPLETED" badge: milestone done, "Release Payment" button
  - Grey border + "PENDING" badge: not yet reached
- Summary bar: Paid / Ready to Release / Remaining amounts

### UI: Supplier Emulator — Milestone Completion

In supplier mode, when a PO has milestones:
- Show milestone list with current status
- "Mark Complete" button on the next pending milestone
- Calls API to set milestone status to COMPLETED

### AP Workflow Integration

Milestone events are tracked independently from the existing `ap_workflow_events_col` table. The milestone progress is shown on the PO detail page as its own visualization (the stacked progress bar + milestone cards). The existing AP workflow timeline remains focused on the claim/approval lifecycle.

If a PO has both milestones and a supplier invoice claim, they are displayed as separate sections on the PO detail page. Milestone payments are recorded directly on `po_milestones_col` (via `paidAt` and `paymentReference`), not through `outgoing_payments_col`, to keep the milestone flow self-contained and avoid requiring a supplier invoice for each milestone payment.

### Milestone Validation

When creating or assigning milestones to a PO, the API must validate that milestone percentages sum to exactly 100%. The `POST /api/milestone-templates` route rejects templates where the sum is not 100.

### API Routes

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/milestone-templates` | GET | List all templates |
| `/api/milestone-templates` | POST | Create new template. Body: `{ name, milestones }` |
| `/api/payable/[id]/milestones` | GET | Get milestones for a PO |
| `/api/payable/[id]/milestones` | POST | Assign milestones from template or custom. Body: `{ templateId }` or `{ milestones: [...] }` |
| `/api/payable/[id]/milestones/[milestoneId]/complete` | POST | Mark milestone as completed |
| `/api/payable/[id]/milestones/[milestoneId]/pay` | POST | Release payment for completed milestone |

Routes with dynamic params use `verifyToken` directly.

### Seeding

- 3 preset templates seeded
- ~30% of POs assigned the "Standard 20/40/40" template with milestones at various stages:
  - Some with all milestones PAID (completed POs)
  - Some with first milestone PAID, second COMPLETED (awaiting payment release)
  - Some with only first milestone PENDING (new POs)

---

## Feature 4: Check Payments (AR)

### Goal

Tenants can pay by check. The flow includes check details entry, deposit slip upload with AI/OCR verification, and a 3 business day clearing period before the payment is confirmed.

### Data Model

#### Modified: `incoming_payments_col`

| New Column | Type | Notes |
|------------|------|-------|
| checkNumber | varchar | Check number (nullable, only for CHECK payments) |
| clearanceDate | date | Expected clearance date (nullable, deposit date + 3 business days) |

The existing `status` column gains two new values: `'PENDING_CLEARANCE'` (between submission and clearance) and `'BOUNCED'` (check bounced after deposit).

The existing `paymentMethod` column gains: `'CHECK'`.

### Payer Portal Flow

On the `/pay` page, a new "Check Payment" option alongside Card and Bank Transfer:

**Step 1 — Check Details:**
- Payee info (Ayala Land Corporation, BPI account details)
- Check number input
- Bank/issuer input
- Clearing notice: "Check payments have a 3 business day clearing period"

**Step 2 — Upload Deposit Slip:**
- Drag & drop or click to upload photo
- AI extraction preview (check number, amount, bank, date, depositor, reference)
- Submit button

**On Submit:**
1. Create incoming payment with `paymentMethod: 'CHECK'`, `status: 'PENDING_CLEARANCE'`
2. Set `checkNumber` from user input
3. Set `clearanceDate` = deposit date + 3 business days (skip weekends)
4. Upload document for OCR processing (existing `/api/documents` flow)
5. Invoice status stays unchanged until clearance

### Admin View — Clearance Tracking

In the payments list, check payments show:
- Method badge: "CHECK" (gold colored)
- Check number
- Deposit date and expected clearance date
- Clearance progress bar (days elapsed / 3 days)
- Actions:
  - "View Deposit Slip" → opens DocumentViewer (existing component)
  - "Confirm Early" → manually confirm before clearance (skips waiting)
  - "Mark Bounced" → rejects the payment, reverts any pending changes

### Auto-Clearance

After clearance date passes, the payment can be auto-confirmed (via the daily cron job at `/api/cron/refresh-insights`, or a dedicated check-clearance cron). On confirmation:
- Status changes from PENDING_CLEARANCE to CONFIRMED
- Payment allocation runs (same `calculateAllocation()` flow as card payments)
- Invoice balances updated

### API Routes

- `POST /api/pay/confirm` — enhanced to handle CHECK method (creates PENDING_CLEARANCE instead of immediate CONFIRMED)
- `POST /api/receivable/payments/[id]/check-action` — **new admin route** for confirming or bouncing a check payment. Uses `verifyToken` directly (dynamic `[id]` param). Body: `{ action: 'confirm' | 'bounce' }`. This is intentionally under `/api/receivable/` (not `/api/pay/`) because it is an admin action requiring authentication, unlike the payer-facing `/api/pay/*` routes which are unauthenticated.

### Utility: `addBusinessDays()`

A new helper function is needed (in `/app/src/lib/utils.ts` or similar) to calculate clearance dates skipping weekends:

```typescript
function addBusinessDays(date: Date, days: number): Date
```

The existing `addDays()` in the seed does not skip weekends.

### Seeding

- 3-5 check payments seeded:
  - One PENDING_CLEARANCE (deposited 1 day ago, clears in 2 days)
  - One PENDING_CLEARANCE (deposited 2 days ago, clears tomorrow)
  - One CONFIRMED (cleared and confirmed, shows completed flow)
  - One BOUNCED (check deposited but bounced, status = 'BOUNCED')

---

## Cross-Cutting Concerns

### Seeding Updates

The seed function needs:

**Schema migration (idempotent ALTER TABLE + CREATE TABLE IF NOT EXISTS):**
- Add new columns to `customers_col`, `invoices_col`, `incoming_payments_col`, `penalty_config_col`
- Create the 5 new tables if not exists

**Truncation:** Add `credit_ledger_col`, `security_deposits_col`, `deposit_forfeitures_col`, `milestone_templates_col`, `po_milestones_col` to the existing single TRUNCATE statement.

**Data seeding:**
- Credit ledger entries for 2-3 customers with overpayments
- Security deposits for all tenants (typically 2-3 months rent)
- Deposit forfeiture records at various stages (4 scenarios)
- Milestone templates (3 presets)
- PO milestones for ~30% of POs
- Check payments at various clearance stages (3-5 payments)

### Settings Enhancements

The existing penalty settings panel gets:
- Deposit forfeiture threshold (days)

### Emulator Enhancements

Supplier emulator gains:
- Milestone list per PO with "Mark Complete" action

Payer emulator could gain:
- Check payment simulation option

### Authentication

All new routes follow existing patterns:
- Routes with dynamic params (`[id]`, `[customerId]`) use `verifyToken` directly
- List routes without params use `withAuth`
- Payer-facing routes under `/api/pay/*` remain unauthenticated (QR token-based)

### Database Access

All queries use the SQL proxy pattern. For new tables, prefer `db.execute(sql.raw(...))` for queries to avoid Drizzle pg-proxy column ordering issues (see memory: feedback_drizzle_proxy.md). Drizzle ORM can be used for inserts and updates where column mapping is not ambiguous.
