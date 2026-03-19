# Penalty Breakdown, AP Supplier Workflow & Document AI Viewer — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add penalty/payment breakdown visibility, a demonstrable AP supplier approval workflow with timeline UI, and a side-by-side document viewer with AI analysis to the Ayala Land Collections Portal.

**Architecture:** Ledger-based approach — new tables track penalties per invoice period (`penalty_ledger_col`), payment allocations (`payment_allocations_col`), and AP workflow events (`ap_workflow_events_col`). The payer portal gets a dynamic payment calculator. The emulator sidebar gains a supplier mode. A reusable document viewer component shows uploaded files alongside AI extraction results.

**Tech Stack:** Next.js 16 App Router, Drizzle ORM (pg-proxy), React 19, Redux Toolkit, Tailwind CSS, Radix UI, Stripe, Gemini Vision

**Spec:** `docs/superpowers/specs/2026-03-19-penalty-ap-workflow-document-ai-design.md`

**No test framework is configured in this project.** Steps that would normally be TDD will instead use manual verification via `npm run build` and browser testing against `npm run dev`.

---

## File Map

### New Files

| File | Responsibility |
|------|---------------|
| `app/src/app/api/penalty-config/route.ts` | GET/PUT penalty configuration |
| `app/src/app/api/receivable/[id]/breakdown/route.ts` | Invoice breakdown with penalties + allocations for a customer |
| `app/src/app/api/pay/preview/route.ts` | Payment allocation preview (no DB write) |
| `app/src/lib/payment-allocation.ts` | Shared payment application logic (penalties-first + FIFO) |
| `app/src/components/receivable/InvoiceBreakdown.tsx` | Admin view: invoice cards with penalty/payment breakdown |
| `app/src/components/receivable/PaymentAllocations.tsx` | Admin view: payment history with allocation detail |
| `app/src/components/pay/BalanceBreakdown.tsx` | Payer portal: outstanding balance breakdown |
| `app/src/components/pay/PartialPaymentCalculator.tsx` | Payer portal: dynamic "what if" calculator |
| `app/src/components/settings/PenaltySettings.tsx` | Settings panel: penalty rate, grace period, method toggle |
| `app/src/app/api/payable/claims/route.ts` | GET (list) / POST (submit) supplier claims |
| `app/src/app/api/payable/claims/[id]/upload/route.ts` | POST upload delivery report |
| `app/src/app/api/payable/claims/[id]/approve/route.ts` | POST AP/FM approval |
| `app/src/app/api/payable/claims/[id]/reject/route.ts` | POST rejection with notes |
| `app/src/app/api/payable/claims/[id]/timeline/route.ts` | GET workflow events |
| `app/src/components/payable/ApprovalQueue.tsx` | AP approval queue with tabs and role actions |
| `app/src/components/payable/WorkflowTimeline.tsx` | Vertical timeline component (reusable) |
| `app/src/components/emulator/SupplierEmulator.tsx` | Emulator supplier mode panel |
| `app/src/components/emulator/EmulatorModeSwitcher.tsx` | Payer/Supplier mode toggle |
| `app/src/components/documents/DocumentViewer.tsx` | Side-by-side document + AI analysis viewer |

### Modified Files

| File | Changes |
|------|---------|
| `app/src/db/schema.ts` | Add 4 new tables, modify invoices + incomingPayments + supplierInvoices |
| `app/src/lib/seed.ts` | Seed penalty config, ledger, allocations, AP workflow events |
| `app/src/types/index.ts` | Add types for penalties, allocations, workflow, document viewer |
| `app/src/store/slices/emulatorSlice.ts` | Add supplier mode state |
| `app/src/components/emulator/CustomerEmulator.tsx` | Wrap with mode switcher |
| `app/src/components/receivable/CustomerDetail.tsx` | Integrate InvoiceBreakdown + PaymentAllocations |
| `app/src/app/pay/page.tsx` | Integrate BalanceBreakdown + PartialPaymentCalculator |
| `app/src/components/layout/Sidebar.tsx` | Add PenaltySettings to settings area |
| `app/src/app/api/pay/confirm/route.ts` | Create allocation records on payment confirm |
| `app/src/app/payable/page.tsx` | Add ApprovalQueue tab/view |

---

## Phase 1: Schema & Seed Foundation

### Task 1: Add new tables to Drizzle schema

**Files:**
- Modify: `app/src/db/schema.ts`

- [ ] **Step 1: Add penalty_config_col table**

After the ML output tables section (~line 295), add:

```typescript
// ─── PENALTY & PAYMENT ALLOCATION ────────────────────────────

export const penaltyConfig = pgTable('penalty_config_col', {
  configId: serial('config_id').primaryKey(),
  penaltyRatePercent: decimal('penalty_rate_percent', { precision: 5, scale: 2 }).notNull().default('2.0'),
  penaltyFrequency: varchar('penalty_frequency', { length: 20 }).notNull().default('MONTHLY'),
  applicationMethod: varchar('application_method', { length: 20 }).notNull().default('PENALTIES_FIRST'),
  gracePeriodDays: integer('grace_period_days').notNull().default(0),
  updatedAt: timestamp('updated_at').defaultNow(),
})
```

- [ ] **Step 2: Add penalty_ledger_col table**

```typescript
export const penaltyLedger = pgTable('penalty_ledger_col', {
  penaltyId: serial('penalty_id').primaryKey(),
  invoiceId: integer('invoice_id').notNull().references(() => invoices.invoiceId),
  periodLabel: varchar('period_label', { length: 20 }).notNull(),
  penaltyAmount: decimal('penalty_amount', { precision: 12, scale: 2 }).notNull(),
  penaltyRate: decimal('penalty_rate', { precision: 5, scale: 2 }).notNull(),
  accrualDate: date('accrual_date').notNull(),
  status: varchar('status', { length: 20 }).notNull().default('ACTIVE'),
  paidAmount: decimal('paid_amount', { precision: 12, scale: 2 }).notNull().default('0'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => [
  index('idx_penalty_ledger_invoice_col').on(table.invoiceId),
])
```

- [ ] **Step 3: Add payment_allocations_col table**

```typescript
export const paymentAllocations = pgTable('payment_allocations_col', {
  allocationId: serial('allocation_id').primaryKey(),
  paymentId: integer('payment_id').notNull().references(() => incomingPayments.paymentId),
  invoiceId: integer('invoice_id').notNull().references(() => invoices.invoiceId),
  penaltyId: integer('penalty_id').references(() => penaltyLedger.penaltyId),
  allocationType: varchar('allocation_type', { length: 20 }).notNull(),
  amount: decimal('amount', { precision: 12, scale: 2 }).notNull(),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => [
  index('idx_alloc_payment_col').on(table.paymentId),
  index('idx_alloc_invoice_col').on(table.invoiceId),
])
```

- [ ] **Step 4: Add ap_workflow_events_col table**

```typescript
// ─── AP WORKFLOW ─────────────────────────────────────────────

export const apWorkflowEvents = pgTable('ap_workflow_events_col', {
  eventId: serial('event_id').primaryKey(),
  supplierInvoiceId: integer('supplier_invoice_id').notNull().references(() => supplierInvoices.supplierInvoiceId),
  poId: integer('po_id').notNull().references(() => purchaseOrders.poId),
  eventType: varchar('event_type', { length: 40 }).notNull(),
  eventData: jsonb('event_data'),
  performedBy: varchar('performed_by', { length: 200 }),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => [
  index('idx_wf_supplier_invoice_col').on(table.supplierInvoiceId),
  index('idx_wf_po_col').on(table.poId),
])
```

- [ ] **Step 5: Modify invoices table — add penalty columns**

In the `invoices` table definition (line 38), add two columns before `issuedAt`:

```typescript
  totalPenalties: decimal('total_penalties', { precision: 12, scale: 2 }).notNull().default('0'),
  penaltiesPaid: decimal('penalties_paid', { precision: 12, scale: 2 }).notNull().default('0'),
```

- [ ] **Step 6: Modify incomingPayments — make invoiceId nullable**

Change line 59 from:
```typescript
  invoiceId: integer('invoice_id').notNull().references(() => invoices.invoiceId),
```
to:
```typescript
  invoiceId: integer('invoice_id').references(() => invoices.invoiceId),
```

- [ ] **Step 7: Modify supplierInvoices — add workflow columns**

In the `supplierInvoices` table definition (line 167), add before `createdAt`:

```typescript
  workflowStatus: varchar('workflow_status', { length: 30 }).notNull().default('SUBMITTED'),
  claimDocumentUrl: text('claim_document_url'),
```

- [ ] **Step 8: Push schema to database**

Run: `cd app && npx drizzle-kit push`

Expected: Schema changes applied successfully.

- [ ] **Step 9: Verify build**

Run: `cd app && npm run build`

Expected: Build succeeds with no type errors.

- [ ] **Step 10: Commit**

```bash
git add app/src/db/schema.ts
git commit -m "feat: add schema for penalties, allocations, and AP workflow"
```

---

### Task 2: Add TypeScript types and update emulator slice

**Files:**
- Modify: `app/src/types/index.ts`
- Modify: `app/src/store/slices/emulatorSlice.ts`

These must be done together since the new `EmulatorState` type is referenced by the slice.

- [ ] **Step 1: Add penalty and allocation types**

Add at the end of the types file:

```typescript
// ─── Penalty & Allocation Types ─────────────────────────────

export interface PenaltyConfig {
  configId: number
  penaltyRatePercent: number
  penaltyFrequency: string
  applicationMethod: 'PENALTIES_FIRST' | 'FIFO'
  gracePeriodDays: number
}

export interface PenaltyLedgerEntry {
  penaltyId: number
  invoiceId: number
  periodLabel: string
  penaltyAmount: number
  penaltyRate: number
  accrualDate: string
  status: 'ACTIVE' | 'PAID' | 'WAIVED'
  paidAmount: number
}

export interface PaymentAllocation {
  allocationId: number
  paymentId: number
  invoiceId: number
  penaltyId: number | null
  allocationType: 'PRINCIPAL' | 'PENALTY'
  amount: number
}

export interface InvoiceBreakdownItem {
  invoiceId: number
  invoiceNumber: string
  billingPeriodStart: string
  billingPeriodEnd: string
  dueDate: string
  amount: number
  balanceRemaining: number
  status: string
  contractNumber: string
  totalPenalties: number
  penaltiesPaid: number
  penalties: PenaltyLedgerEntry[]
  daysOverdue: number
}

export interface PaymentWithAllocations {
  paymentId: number
  amount: number
  paymentMethod: string
  paymentDate: string
  referenceNumber: string | null
  status: string
  allocations: PaymentAllocation[]
}

export interface CustomerBreakdown {
  customer: { customerId: number; name: string; accountNumber: string }
  invoices: InvoiceBreakdownItem[]
  payments: PaymentWithAllocations[]
  totals: {
    totalPrincipal: number
    totalPenalties: number
    totalPaid: number
    grandTotalDue: number
  }
}

export interface AllocationPreview {
  applied: { invoiceId: number; invoiceNumber: string; allocationType: 'PRINCIPAL' | 'PENALTY'; penaltyId?: number; periodLabel?: string; amount: number }[]
  remaining: { invoiceId: number; invoiceNumber: string; type: 'PRINCIPAL' | 'PENALTY'; periodLabel?: string; amount: number }[]
  totalApplied: number
  totalRemaining: number
  monthlyPenaltyAccrual: number
}

// ─── AP Workflow Types ──────────────────────────────────────

export type WorkflowStatus = 'SUBMITTED' | 'GR_CONFIRMED' | 'MATCHED' | 'PENDING_AP_REVIEW' | 'AP_APPROVED' | 'PENDING_FM_REVIEW' | 'FM_APPROVED' | 'REJECTED' | 'PAYMENT_SCHEDULED' | 'RELEASED'

export type WorkflowEventType = 'CLAIM_SUBMITTED' | 'DELIVERY_REPORT_UPLOADED' | 'GR_CONFIRMED' | 'INVOICE_SUBMITTED' | 'THREE_WAY_MATCH' | 'AP_CLERK_APPROVED' | 'AP_CLERK_REJECTED' | 'FM_APPROVED' | 'FM_REJECTED' | 'PAYMENT_SCHEDULED' | 'PAYMENT_RELEASED'

export interface WorkflowEvent {
  eventId: number
  supplierInvoiceId: number
  poId: number
  eventType: WorkflowEventType
  eventData: Record<string, unknown> | null
  performedBy: string | null
  notes: string | null
  createdAt: string
}

export interface ClaimSummary {
  supplierInvoiceId: number
  invoiceNumber: string
  supplierName: string
  supplierId: number
  poNumber: string
  poId: number
  amount: number
  workflowStatus: WorkflowStatus
  submittedDate: string
  grVerified: boolean
  threeWayMatch: string | null
  claimDocumentUrl: string | null
}

// ─── Emulator Types ─────────────────────────────────────────

export type EmulatorMode = 'payer' | 'supplier'

export interface EmulatorState {
  isOpen: boolean
  mode: EmulatorMode
  // Payer mode
  selectedCustomerId: number | null
  activeTab: 'invoices' | 'qr' | 'upload' | 'history'
  selectedInvoiceId: number | null
  // Supplier mode
  selectedSupplierId: number | null
  selectedPoId: number | null
}

// ─── Document Viewer Types ──────────────────────────────────

export interface DocumentViewerData {
  documentId: number
  fileUrl: string
  fileName: string
  fileType: string
  ocrResult: OcrResult | null
  ocrStatus: string
  validationResult: ValidationResult | null
  customerName?: string
  invoiceNumber?: string
  expectedAmount?: number
}
```

- [ ] **Step 2: Update emulator slice for new EmulatorState**

Replace the full `app/src/store/slices/emulatorSlice.ts`:

```typescript
import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import { EmulatorState, EmulatorMode } from '@/types'

const initialState: EmulatorState = {
  isOpen: false,
  mode: 'payer',
  selectedCustomerId: null,
  activeTab: 'invoices',
  selectedInvoiceId: null,
  selectedSupplierId: null,
  selectedPoId: null,
}

const emulatorSlice = createSlice({
  name: 'emulator',
  initialState,
  reducers: {
    toggleEmulator(state) { state.isOpen = !state.isOpen },
    openEmulator(state) { state.isOpen = true },
    closeEmulator(state) { state.isOpen = false },
    setEmulatorMode(state, action: PayloadAction<EmulatorMode>) {
      state.mode = action.payload
    },
    setSelectedCustomer(state, action: PayloadAction<number | null>) {
      state.selectedCustomerId = action.payload
      state.selectedInvoiceId = null
    },
    setActiveTab(state, action: PayloadAction<EmulatorState['activeTab']>) {
      state.activeTab = action.payload
    },
    setSelectedInvoice(state, action: PayloadAction<number | null>) {
      state.selectedInvoiceId = action.payload
    },
    setSelectedSupplier(state, action: PayloadAction<number | null>) {
      state.selectedSupplierId = action.payload
      state.selectedPoId = null
    },
    setSelectedPo(state, action: PayloadAction<number | null>) {
      state.selectedPoId = action.payload
    },
  },
})

export const {
  toggleEmulator, openEmulator, closeEmulator, setEmulatorMode,
  setSelectedCustomer, setActiveTab, setSelectedInvoice,
  setSelectedSupplier, setSelectedPo,
} = emulatorSlice.actions
export default emulatorSlice.reducer
```

- [ ] **Step 3: Verify build**

Run: `cd app && npm run build`

Expected: Build succeeds with new types and updated emulator slice.

- [ ] **Step 4: Commit**

```bash
git add app/src/types/index.ts app/src/store/slices/emulatorSlice.ts
git commit -m "feat: add types for penalties, AP workflow, emulator and update emulator slice"
```

---

### Task 3: Update seed function

**Files:**
- Modify: `app/src/lib/seed.ts`

This task adds seeding for: penalty config, penalty ledger entries, payment allocations, AP workflow events, and supplier invoice workflow statuses. All new seed logic goes **after** the existing seeding steps (after the cash flow forecasts insert, around line 1046).

- [ ] **Step 1: Import new schema tables at top of seed.ts**

Add to the existing import from `@/db/schema`:

```typescript
import {
  // ... existing imports ...
  penaltyConfig, penaltyLedger, paymentAllocations, apWorkflowEvents,
} from '@/db/schema'
```

Also add `eq` to the drizzle-orm import (the existing file only imports `sql`):

```typescript
import { sql, eq } from 'drizzle-orm'
```

- [ ] **Step 2: Add truncation for new tables**

In the truncation section (~line 191-224), add SQL statements for the new tables before the existing truncations:

```sql
TRUNCATE TABLE penalty_config_col RESTART IDENTITY CASCADE;
TRUNCATE TABLE penalty_ledger_col RESTART IDENTITY CASCADE;
TRUNCATE TABLE payment_allocations_col RESTART IDENTITY CASCADE;
TRUNCATE TABLE ap_workflow_events_col RESTART IDENTITY CASCADE;
```

- [ ] **Step 3: Add ALTER TABLE for new columns**

In the section with existing ALTER TABLE statements, add:

```sql
ALTER TABLE invoices_col ADD COLUMN IF NOT EXISTS total_penalties DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE invoices_col ADD COLUMN IF NOT EXISTS penalties_paid DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE supplier_invoices_col ADD COLUMN IF NOT EXISTS workflow_status VARCHAR(30) NOT NULL DEFAULT 'SUBMITTED';
ALTER TABLE supplier_invoices_col ADD COLUMN IF NOT EXISTS claim_document_url TEXT;
```

And modify the incoming_payments invoiceId constraint:

```sql
ALTER TABLE incoming_payments_col ALTER COLUMN invoice_id DROP NOT NULL;
```

- [ ] **Step 4: Seed penalty config (after cash flow forecasts)**

```typescript
// ── Penalty Config ──
await db.insert(penaltyConfig).values({
  penaltyRatePercent: '2.0',
  penaltyFrequency: 'MONTHLY',
  applicationMethod: 'PENALTIES_FIRST',
  gracePeriodDays: 0,
})
console.log('  Penalty config seeded')
```

- [ ] **Step 5: Seed penalty ledger entries for overdue invoices**

After penalty config, iterate through the already-inserted invoices. For each OVERDUE or PARTIAL invoice, calculate how many months overdue it is and create penalty ledger entries:

```typescript
// ── Penalty Ledger ──
const overdueInvoices = await db.select().from(invoices)
  .where(sql`${invoices.status} IN ('OVERDUE', 'PARTIAL') AND ${invoices.dueDate} < CURRENT_DATE`)

const penaltyRate = 2.0
let penaltyCount = 0
for (const inv of overdueInvoices) {
  const dueDate = new Date(inv.dueDate)
  const now = new Date('2026-03-19')
  const monthsOverdue = Math.max(1, Math.ceil((now.getTime() - dueDate.getTime()) / (30 * 24 * 60 * 60 * 1000)))
  const principal = Number(inv.amount)
  let totalPen = 0

  for (let m = 1; m <= monthsOverdue; m++) {
    const penAmt = Math.round(principal * (penaltyRate / 100) * 100) / 100
    const accrualDate = addMonths(dueDate, m)
    await db.insert(penaltyLedger).values({
      invoiceId: inv.invoiceId,
      periodLabel: `Month ${m}`,
      penaltyAmount: String(penAmt),
      penaltyRate: String(penaltyRate),
      accrualDate: fmtDate(accrualDate),
      status: 'ACTIVE',
      paidAmount: '0',
    })
    totalPen += penAmt
    penaltyCount++
  }

  // Update denormalized totals
  await db.update(invoices)
    .set({ totalPenalties: String(totalPen), penaltiesPaid: '0' })
    .where(eq(invoices.invoiceId, inv.invoiceId))
}
console.log(`  ${penaltyCount} penalty ledger entries seeded`)
```

- [ ] **Step 6: Seed payment allocations for existing payments**

For each existing incoming payment that is CONFIRMED, create a PRINCIPAL allocation:

```typescript
// ── Payment Allocations ──
const confirmedPayments = await db.select().from(incomingPayments)
  .where(eq(incomingPayments.status, 'CONFIRMED'))

let allocCount = 0
for (const pay of confirmedPayments) {
  if (pay.invoiceId) {
    await db.insert(paymentAllocations).values({
      paymentId: pay.paymentId,
      invoiceId: pay.invoiceId,
      allocationType: 'PRINCIPAL',
      amount: pay.amount,
    })
    allocCount++
  }
}
console.log(`  ${allocCount} payment allocations seeded`)
```

- [ ] **Step 7: Seed AP workflow events and workflow statuses**

For existing supplier invoices, assign workflow statuses based on payment status and create timeline events:

```typescript
// ── AP Workflow Events ──
const allSupplierInvoices = await db.select({
  si: supplierInvoices,
  po: purchaseOrders,
  sup: suppliers,
}).from(supplierInvoices)
  .innerJoin(purchaseOrders, eq(supplierInvoices.poId, purchaseOrders.poId))
  .innerJoin(suppliers, eq(supplierInvoices.supplierId, suppliers.supplierId))

const WORKFLOW_STEPS: { eventType: string; status: string; performer: string }[] = [
  { eventType: 'CLAIM_SUBMITTED', status: 'SUBMITTED', performer: 'supplier' },
  { eventType: 'DELIVERY_REPORT_UPLOADED', status: 'SUBMITTED', performer: 'supplier' },
  { eventType: 'GR_CONFIRMED', status: 'GR_CONFIRMED', performer: 'Warehouse Team' },
  { eventType: 'THREE_WAY_MATCH', status: 'MATCHED', performer: 'system' },
  { eventType: 'AP_CLERK_APPROVED', status: 'AP_APPROVED', performer: 'ap.clerk@ayalaland.com' },
  { eventType: 'FM_APPROVED', status: 'FM_APPROVED', performer: 'finance.mgr@ayalaland.com' },
  { eventType: 'PAYMENT_SCHEDULED', status: 'PAYMENT_SCHEDULED', performer: 'system' },
  { eventType: 'PAYMENT_RELEASED', status: 'RELEASED', performer: 'system' },
]

let eventCount = 0
for (let i = 0; i < allSupplierInvoices.length; i++) {
  const { si, po, sup } = allSupplierInvoices[i]

  // Determine how far along the workflow based on payment status
  let stepsCompleted: number
  if (si.paymentStatus === 'PAID') {
    stepsCompleted = 8 // all steps
  } else if (si.paymentStatus === 'PARTIAL') {
    stepsCompleted = 6 // up to FM_APPROVED
  } else {
    // UNPAID — distribute across early stages
    stepsCompleted = pick([2, 3, 4, 5])
  }

  const finalStatus = WORKFLOW_STEPS[stepsCompleted - 1].status
  await db.update(supplierInvoices)
    .set({ workflowStatus: finalStatus })
    .where(eq(supplierInvoices.supplierInvoiceId, si.supplierInvoiceId))

  // Create events for completed steps
  const baseDate = new Date(si.submittedDate)
  for (let s = 0; s < stepsCompleted; s++) {
    const step = WORKFLOW_STEPS[s]
    const eventDate = addDays(baseDate, s * 2 + randInt(0, 1))
    await db.insert(apWorkflowEvents).values({
      supplierInvoiceId: si.supplierInvoiceId,
      poId: si.poId,
      eventType: step.eventType,
      eventData: { amount: si.amount, supplierName: sup.name, poNumber: po.poNumber },
      performedBy: step.performer === 'supplier' ? sup.name : step.performer,
      createdAt: eventDate,
    })
    eventCount++
  }
}
console.log(`  ${eventCount} AP workflow events seeded`)
```

- [ ] **Step 8: Verify build and test seed**

Run: `cd app && npm run build`

Then start dev server and trigger seed via UI or `curl -X POST http://localhost:3000/api/seed` (with auth).

Expected: Seed completes without errors. New tables populated.

- [ ] **Step 9: Commit**

```bash
git add app/src/lib/seed.ts
git commit -m "feat: seed penalty config, ledger, allocations, and AP workflow events"
```

---

## Phase 2: Feature 1 — Penalty & Payment Breakdown

### Task 4: Payment allocation logic (shared library)

**Files:**
- Create: `app/src/lib/payment-allocation.ts`

- [ ] **Step 1: Create the allocation calculation module**

This is a pure function that takes outstanding invoices with penalties and a payment amount, and returns how the payment should be applied. Used by both the preview API and the confirm API.

```typescript
import { InvoiceBreakdownItem, AllocationPreview } from '@/types'

interface InvoiceWithPenalties {
  invoiceId: number
  invoiceNumber: string
  balanceRemaining: number
  dueDate: string
  penalties: { penaltyId: number; periodLabel: string; amount: number; paidAmount: number; status: string }[]
}

export function calculateAllocation(
  invoicesWithPenalties: InvoiceWithPenalties[],
  paymentAmount: number,
  method: 'PENALTIES_FIRST' | 'FIFO',
  penaltyRate: number,
): AllocationPreview {
  // Sort oldest first by due date
  const sorted = [...invoicesWithPenalties].sort(
    (a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
  )

  let remaining = paymentAmount
  const applied: AllocationPreview['applied'] = []
  const outstanding: AllocationPreview['remaining'] = []

  if (method === 'PENALTIES_FIRST') {
    // Pass 1: Apply to all penalties (oldest invoice first)
    for (const inv of sorted) {
      for (const pen of inv.penalties) {
        if (pen.status !== 'ACTIVE') continue
        const unpaid = pen.amount - pen.paidAmount
        if (unpaid <= 0) continue
        const apply = Math.min(remaining, unpaid)
        if (apply > 0) {
          applied.push({
            invoiceId: inv.invoiceId,
            invoiceNumber: inv.invoiceNumber,
            allocationType: 'PENALTY',
            penaltyId: pen.penaltyId,
            periodLabel: pen.periodLabel,
            amount: Math.round(apply * 100) / 100,
          })
          remaining -= apply
        }
        if (remaining <= 0) break
      }
      if (remaining <= 0) break
    }

    // Pass 2: Apply to principal (oldest first)
    for (const inv of sorted) {
      if (remaining <= 0) break
      const principal = inv.balanceRemaining
      if (principal <= 0) continue
      const apply = Math.min(remaining, principal)
      if (apply > 0) {
        applied.push({
          invoiceId: inv.invoiceId,
          invoiceNumber: inv.invoiceNumber,
          allocationType: 'PRINCIPAL',
          amount: Math.round(apply * 100) / 100,
        })
        remaining -= apply
      }
    }
  } else {
    // FIFO: per-invoice (penalties then principal) before moving to next
    for (const inv of sorted) {
      if (remaining <= 0) break

      // Penalties for this invoice first
      for (const pen of inv.penalties) {
        if (pen.status !== 'ACTIVE') continue
        const unpaid = pen.amount - pen.paidAmount
        if (unpaid <= 0) continue
        const apply = Math.min(remaining, unpaid)
        if (apply > 0) {
          applied.push({
            invoiceId: inv.invoiceId,
            invoiceNumber: inv.invoiceNumber,
            allocationType: 'PENALTY',
            penaltyId: pen.penaltyId,
            periodLabel: pen.periodLabel,
            amount: Math.round(apply * 100) / 100,
          })
          remaining -= apply
        }
      }

      // Then principal
      if (remaining > 0) {
        const principal = inv.balanceRemaining
        if (principal > 0) {
          const apply = Math.min(remaining, principal)
          applied.push({
            invoiceId: inv.invoiceId,
            invoiceNumber: inv.invoiceNumber,
            allocationType: 'PRINCIPAL',
            amount: Math.round(apply * 100) / 100,
          })
          remaining -= apply
        }
      }
    }
  }

  // Build "still outstanding" list
  // Track what was applied per invoice/penalty
  const appliedMap = new Map<string, number>()
  for (const a of applied) {
    const key = a.penaltyId ? `pen-${a.penaltyId}` : `pri-${a.invoiceId}`
    appliedMap.set(key, (appliedMap.get(key) || 0) + a.amount)
  }

  for (const inv of sorted) {
    for (const pen of inv.penalties) {
      if (pen.status !== 'ACTIVE') continue
      const unpaid = pen.amount - pen.paidAmount
      const wasApplied = appliedMap.get(`pen-${pen.penaltyId}`) || 0
      const stillOwed = Math.round((unpaid - wasApplied) * 100) / 100
      if (stillOwed > 0) {
        outstanding.push({
          invoiceId: inv.invoiceId,
          invoiceNumber: inv.invoiceNumber,
          type: 'PENALTY',
          periodLabel: pen.periodLabel,
          amount: stillOwed,
        })
      }
    }
    const principalApplied = appliedMap.get(`pri-${inv.invoiceId}`) || 0
    const principalRemaining = Math.round((inv.balanceRemaining - principalApplied) * 100) / 100
    if (principalRemaining > 0) {
      outstanding.push({
        invoiceId: inv.invoiceId,
        invoiceNumber: inv.invoiceNumber,
        type: 'PRINCIPAL',
        amount: principalRemaining,
      })
    }
  }

  const totalRemaining = outstanding.reduce((s, o) => s + o.amount, 0)
  const monthlyPenaltyAccrual = Math.round(totalRemaining * (penaltyRate / 100) * 100) / 100

  return {
    applied,
    remaining: outstanding,
    totalApplied: Math.round((paymentAmount - Math.max(0, remaining)) * 100) / 100,
    totalRemaining: Math.round(totalRemaining * 100) / 100,
    monthlyPenaltyAccrual,
  }
}
```

- [ ] **Step 2: Verify build**

Run: `cd app && npm run build`

- [ ] **Step 3: Commit**

```bash
git add app/src/lib/payment-allocation.ts
git commit -m "feat: add payment allocation calculation logic"
```

---

### Task 5: Penalty config API

**Files:**
- Create: `app/src/app/api/penalty-config/route.ts`

- [ ] **Step 1: Create GET and PUT handlers**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { penaltyConfig } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { withAuth } from '@/lib/auth-middleware'

// GET /api/penalty-config
export const GET = withAuth(async () => {
  const rows = await db.select().from(penaltyConfig).limit(1)
  if (!rows.length) {
    return NextResponse.json({
      configId: 0,
      penaltyRatePercent: 2.0,
      penaltyFrequency: 'MONTHLY',
      applicationMethod: 'PENALTIES_FIRST',
      gracePeriodDays: 0,
    })
  }
  const c = rows[0]
  return NextResponse.json({
    configId: c.configId,
    penaltyRatePercent: Number(c.penaltyRatePercent),
    penaltyFrequency: c.penaltyFrequency,
    applicationMethod: c.applicationMethod,
    gracePeriodDays: c.gracePeriodDays,
  })
})

// PUT /api/penalty-config
export const PUT = withAuth(async (request: NextRequest) => {
  const body = await request.json()
  const { penaltyRatePercent, applicationMethod, gracePeriodDays } = body

  const rows = await db.select().from(penaltyConfig).limit(1)
  if (rows.length) {
    await db.update(penaltyConfig)
      .set({
        penaltyRatePercent: String(penaltyRatePercent),
        applicationMethod,
        gracePeriodDays,
        updatedAt: new Date(),
      })
      .where(eq(penaltyConfig.configId, rows[0].configId))
  } else {
    await db.insert(penaltyConfig).values({
      penaltyRatePercent: String(penaltyRatePercent),
      applicationMethod,
      gracePeriodDays,
    })
  }

  return NextResponse.json({ success: true })
})
```

- [ ] **Step 2: Verify build**

Run: `cd app && npm run build`

- [ ] **Step 3: Commit**

```bash
git add app/src/app/api/penalty-config/route.ts
git commit -m "feat: add penalty config API (GET/PUT)"
```

---

### Task 6: Customer breakdown API

**Files:**
- Create: `app/src/app/api/receivable/[id]/breakdown/route.ts`

- [ ] **Step 1: Create GET handler**

Returns invoices with penalty details and payment allocations for a customer.

**Important:** Dynamic `[id]` routes cannot use the `withAuth()` wrapper because it only forwards `(request, user)` and drops the `params` context. Use `verifyToken` directly instead, matching the existing pattern in `app/src/app/api/receivable/[id]/route.ts`.

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth-middleware'
import { db } from '@/db'
import { customers, invoices, contracts, penaltyLedger, incomingPayments, paymentAllocations } from '@/db/schema'
import { eq, desc, sql } from 'drizzle-orm'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await verifyToken(request)
  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  const { id } = await params
  const customerId = parseInt(id, 10)

  // Customer info
  const customerRows = await db.select().from(customers).where(eq(customers.customerId, customerId)).limit(1)
  if (!customerRows.length) {
    return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
  }
  const customer = customerRows[0]

  // Invoices with contract info
  const invoiceRows = await db
    .select({
      invoiceId: invoices.invoiceId,
      invoiceNumber: invoices.invoiceNumber,
      billingPeriodStart: invoices.billingPeriodStart,
      billingPeriodEnd: invoices.billingPeriodEnd,
      dueDate: invoices.dueDate,
      amount: invoices.amount,
      balanceRemaining: invoices.balanceRemaining,
      status: invoices.status,
      totalPenalties: invoices.totalPenalties,
      penaltiesPaid: invoices.penaltiesPaid,
      contractNumber: contracts.contractNumber,
    })
    .from(invoices)
    .leftJoin(contracts, eq(invoices.contractId, contracts.contractId))
    .where(eq(invoices.customerId, customerId))
    .orderBy(invoices.dueDate)

  // Penalties for all these invoices
  const invoiceIds = invoiceRows.map(i => i.invoiceId)
  const penaltyRows = invoiceIds.length > 0
    ? await db.select().from(penaltyLedger)
        .where(sql`${penaltyLedger.invoiceId} IN (${sql.join(invoiceIds.map(id => sql`${id}`), sql`, `)})`)
    : []

  // Group penalties by invoiceId
  const penaltiesByInvoice = new Map<number, typeof penaltyRows>()
  for (const p of penaltyRows) {
    const arr = penaltiesByInvoice.get(p.invoiceId) || []
    arr.push(p)
    penaltiesByInvoice.set(p.invoiceId, arr)
  }

  // Payments with allocations
  const paymentRows = await db
    .select()
    .from(incomingPayments)
    .where(eq(incomingPayments.customerId, customerId))
    .orderBy(desc(incomingPayments.paymentDate))
    .limit(20)

  const paymentIds = paymentRows.map(p => p.paymentId)
  const allocationRows = paymentIds.length > 0
    ? await db.select().from(paymentAllocations)
        .where(sql`${paymentAllocations.paymentId} IN (${sql.join(paymentIds.map(id => sql`${id}`), sql`, `)})`)
    : []

  const allocationsByPayment = new Map<number, typeof allocationRows>()
  for (const a of allocationRows) {
    const arr = allocationsByPayment.get(a.paymentId) || []
    arr.push(a)
    allocationsByPayment.set(a.paymentId, arr)
  }

  const now = new Date()
  const invoicesOut = invoiceRows.map(inv => {
    const dueDate = new Date(inv.dueDate)
    const daysOverdue = Math.max(0, Math.floor((now.getTime() - dueDate.getTime()) / (86400000)))
    const pens = (penaltiesByInvoice.get(inv.invoiceId) || []).map(p => ({
      penaltyId: p.penaltyId,
      invoiceId: p.invoiceId,
      periodLabel: p.periodLabel,
      penaltyAmount: Number(p.penaltyAmount),
      penaltyRate: Number(p.penaltyRate),
      accrualDate: p.accrualDate,
      status: p.status as 'ACTIVE' | 'PAID' | 'WAIVED',
      paidAmount: Number(p.paidAmount),
    }))
    return {
      invoiceId: inv.invoiceId,
      invoiceNumber: inv.invoiceNumber,
      billingPeriodStart: inv.billingPeriodStart,
      billingPeriodEnd: inv.billingPeriodEnd,
      dueDate: inv.dueDate,
      amount: Number(inv.amount),
      balanceRemaining: Number(inv.balanceRemaining),
      status: inv.status,
      contractNumber: inv.contractNumber || '',
      totalPenalties: Number(inv.totalPenalties),
      penaltiesPaid: Number(inv.penaltiesPaid),
      penalties: pens,
      daysOverdue,
    }
  })

  const paymentsOut = paymentRows.map(p => ({
    paymentId: p.paymentId,
    amount: Number(p.amount),
    paymentMethod: p.paymentMethod,
    paymentDate: p.paymentDate?.toISOString() || '',
    referenceNumber: p.referenceNumber,
    status: p.status,
    allocations: (allocationsByPayment.get(p.paymentId) || []).map(a => ({
      allocationId: a.allocationId,
      paymentId: a.paymentId,
      invoiceId: a.invoiceId,
      penaltyId: a.penaltyId,
      allocationType: a.allocationType as 'PRINCIPAL' | 'PENALTY',
      amount: Number(a.amount),
    })),
  }))

  const totalPrincipal = invoicesOut.reduce((s, i) => s + i.amount, 0)
  const totalPenalties = invoicesOut.reduce((s, i) => s + i.totalPenalties, 0)
  const totalPaid = paymentsOut.filter(p => p.status === 'CONFIRMED').reduce((s, p) => s + p.amount, 0)

  return NextResponse.json({
    customer: { customerId: customer.customerId, name: customer.name, accountNumber: customer.accountNumber },
    invoices: invoicesOut,
    payments: paymentsOut,
    totals: {
      totalPrincipal,
      totalPenalties,
      totalPaid,
      grandTotalDue: totalPrincipal + totalPenalties - totalPaid,
    },
  })
}
```

- [ ] **Step 2: Verify build**

Run: `cd app && npm run build`

- [ ] **Step 3: Commit**

```bash
git add app/src/app/api/receivable/\[id\]/breakdown/route.ts
git commit -m "feat: add customer invoice breakdown API with penalties and allocations"
```

---

### Task 7: Payment preview API

**Files:**
- Create: `app/src/app/api/pay/preview/route.ts`

- [ ] **Step 1: Create POST handler (no auth — payer-facing)**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { invoices, penaltyLedger, penaltyConfig } from '@/db/schema'
import { eq, sql } from 'drizzle-orm'
import { calculateAllocation } from '@/lib/payment-allocation'

// POST /api/pay/preview — Calculate how a payment would be applied (no DB write)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { customerId, amount } = body

    if (!customerId || !amount || amount <= 0) {
      return NextResponse.json({ error: 'customerId and positive amount required' }, { status: 400 })
    }

    // Get penalty config
    const configRows = await db.select().from(penaltyConfig).limit(1)
    const config = configRows[0]
    const method = (config?.applicationMethod || 'PENALTIES_FIRST') as 'PENALTIES_FIRST' | 'FIFO'
    const penaltyRate = Number(config?.penaltyRatePercent || 2)

    // Get outstanding invoices for this customer
    const invoiceRows = await db
      .select({
        invoiceId: invoices.invoiceId,
        invoiceNumber: invoices.invoiceNumber,
        balanceRemaining: invoices.balanceRemaining,
        dueDate: invoices.dueDate,
      })
      .from(invoices)
      .where(sql`${invoices.customerId} = ${customerId} AND ${invoices.status} != 'PAID'`)
      .orderBy(invoices.dueDate)

    // Get penalties for these invoices
    const invoiceIds = invoiceRows.map(i => i.invoiceId)
    const penaltyRows = invoiceIds.length > 0
      ? await db.select().from(penaltyLedger)
          .where(sql`${penaltyLedger.invoiceId} IN (${sql.join(invoiceIds.map(id => sql`${id}`), sql`, `)}) AND ${penaltyLedger.status} = 'ACTIVE'`)
      : []

    const penaltiesByInvoice = new Map<number, typeof penaltyRows>()
    for (const p of penaltyRows) {
      const arr = penaltiesByInvoice.get(p.invoiceId) || []
      arr.push(p)
      penaltiesByInvoice.set(p.invoiceId, arr)
    }

    const invoicesWithPenalties = invoiceRows.map(inv => ({
      invoiceId: inv.invoiceId,
      invoiceNumber: inv.invoiceNumber,
      balanceRemaining: Number(inv.balanceRemaining),
      dueDate: inv.dueDate,
      penalties: (penaltiesByInvoice.get(inv.invoiceId) || []).map(p => ({
        penaltyId: p.penaltyId,
        periodLabel: p.periodLabel,
        amount: Number(p.penaltyAmount),
        paidAmount: Number(p.paidAmount),
        status: p.status,
      })),
    }))

    const preview = calculateAllocation(invoicesWithPenalties, amount, method, penaltyRate)

    return NextResponse.json(preview)
  } catch (error) {
    console.error('Preview failed:', error)
    return NextResponse.json({ error: 'Preview calculation failed' }, { status: 500 })
  }
}
```

- [ ] **Step 2: Verify build**

Run: `cd app && npm run build`

- [ ] **Step 3: Commit**

```bash
git add app/src/app/api/pay/preview/route.ts
git commit -m "feat: add payment allocation preview API"
```

---

### Task 8: Enhance payment confirm to create allocations

**Files:**
- Modify: `app/src/app/api/pay/confirm/route.ts`

- [ ] **Step 1: Update confirm route to write allocation records**

After the existing payment creation (step 3 in the file), add allocation logic. The enhanced flow:
1. Verify Stripe payment (existing)
2. Load penalty config and outstanding invoices with penalties for the customer
3. Run `calculateAllocation()` to determine how to apply
4. Create incoming payment record (existing, but now invoiceId may be null for multi-invoice)
5. Write allocation rows
6. Update penalty ledger entries (mark PAID, update paidAmount)
7. Update invoice balances and penalty totals

This is a substantial rewrite of the confirm route. Replace the file contents:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { invoices, incomingPayments, penaltyConfig, penaltyLedger, paymentAllocations } from '@/db/schema'
import { eq, sql } from 'drizzle-orm'
import { stripe } from '@/lib/stripe'
import { calculateAllocation } from '@/lib/payment-allocation'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { paymentIntentId, invoiceId, customerId, amount } = body

    if (!paymentIntentId) {
      return NextResponse.json({ error: 'paymentIntentId is required' }, { status: 400 })
    }
    if (!amount || typeof amount !== 'number' || amount <= 0) {
      return NextResponse.json({ error: 'amount must be a positive number' }, { status: 400 })
    }

    // Verify Stripe payment
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId)
    if (paymentIntent.status !== 'succeeded') {
      return NextResponse.json(
        { error: `Payment not succeeded. Status: ${paymentIntent.status}` },
        { status: 400 }
      )
    }

    // Determine customerId from invoiceId if not provided
    let cid = customerId
    if (!cid && invoiceId) {
      const invRow = await db.select({ customerId: invoices.customerId }).from(invoices).where(eq(invoices.invoiceId, invoiceId)).limit(1)
      cid = invRow[0]?.customerId
    }
    if (!cid) {
      return NextResponse.json({ error: 'Could not determine customer' }, { status: 400 })
    }

    // Load config
    const configRows = await db.select().from(penaltyConfig).limit(1)
    const config = configRows[0]
    const method = (config?.applicationMethod || 'PENALTIES_FIRST') as 'PENALTIES_FIRST' | 'FIFO'
    const penaltyRate = Number(config?.penaltyRatePercent || 2)

    // Load outstanding invoices
    const invoiceRows = await db.select().from(invoices)
      .where(sql`${invoices.customerId} = ${cid} AND ${invoices.status} != 'PAID'`)
      .orderBy(invoices.dueDate)

    // Load penalties
    const invIds = invoiceRows.map(i => i.invoiceId)
    const penaltyRows = invIds.length > 0
      ? await db.select().from(penaltyLedger)
          .where(sql`${penaltyLedger.invoiceId} IN (${sql.join(invIds.map(id => sql`${id}`), sql`, `)}) AND ${penaltyLedger.status} = 'ACTIVE'`)
      : []

    const penMap = new Map<number, typeof penaltyRows>()
    for (const p of penaltyRows) {
      const arr = penMap.get(p.invoiceId) || []
      arr.push(p)
      penMap.set(p.invoiceId, arr)
    }

    const invoicesForCalc = invoiceRows.map(inv => ({
      invoiceId: inv.invoiceId,
      invoiceNumber: inv.invoiceNumber,
      balanceRemaining: Number(inv.balanceRemaining),
      dueDate: inv.dueDate,
      penalties: (penMap.get(inv.invoiceId) || []).map(p => ({
        penaltyId: p.penaltyId,
        periodLabel: p.periodLabel,
        amount: Number(p.penaltyAmount),
        paidAmount: Number(p.paidAmount),
        status: p.status,
      })),
    }))

    const allocation = calculateAllocation(invoicesForCalc, amount, method, penaltyRate)

    // Create payment record (invoiceId null for multi-invoice allocation)
    const [payment] = await db.insert(incomingPayments).values({
      invoiceId: invoiceId || null,
      customerId: cid,
      amount: String(amount),
      paymentMethod: 'CARD',
      stripePaymentIntentId: paymentIntentId,
      status: 'CONFIRMED',
      confirmedAt: new Date(),
    }).returning()

    // Write allocation rows
    for (const a of allocation.applied) {
      await db.insert(paymentAllocations).values({
        paymentId: payment.paymentId,
        invoiceId: a.invoiceId,
        penaltyId: a.penaltyId || null,
        allocationType: a.allocationType,
        amount: String(a.amount),
      })
    }

    // Update penalty ledger entries
    const penaltyUpdates = new Map<number, number>()
    for (const a of allocation.applied) {
      if (a.allocationType === 'PENALTY' && a.penaltyId) {
        penaltyUpdates.set(a.penaltyId, (penaltyUpdates.get(a.penaltyId) || 0) + a.amount)
      }
    }
    for (const [penId, addedAmount] of penaltyUpdates) {
      const pen = penaltyRows.find(p => p.penaltyId === penId)
      if (pen) {
        const newPaid = Number(pen.paidAmount) + addedAmount
        const newStatus = newPaid >= Number(pen.penaltyAmount) ? 'PAID' : 'ACTIVE'
        await db.update(penaltyLedger)
          .set({ paidAmount: String(newPaid), status: newStatus, updatedAt: new Date() })
          .where(eq(penaltyLedger.penaltyId, penId))
      }
    }

    // Update invoice balances
    const principalByInvoice = new Map<number, number>()
    for (const a of allocation.applied) {
      if (a.allocationType === 'PRINCIPAL') {
        principalByInvoice.set(a.invoiceId, (principalByInvoice.get(a.invoiceId) || 0) + a.amount)
      }
    }
    const penaltiesPaidByInvoice = new Map<number, number>()
    for (const a of allocation.applied) {
      if (a.allocationType === 'PENALTY') {
        penaltiesPaidByInvoice.set(a.invoiceId, (penaltiesPaidByInvoice.get(a.invoiceId) || 0) + a.amount)
      }
    }

    for (const inv of invoiceRows) {
      const principalPaid = principalByInvoice.get(inv.invoiceId) || 0
      const penPaid = penaltiesPaidByInvoice.get(inv.invoiceId) || 0
      if (principalPaid > 0 || penPaid > 0) {
        const newBalance = Math.max(0, Number(inv.balanceRemaining) - principalPaid)
        const newPenPaid = Number(inv.penaltiesPaid) + penPaid
        const newStatus = newBalance <= 0 ? 'PAID' : 'PARTIAL'
        await db.update(invoices)
          .set({
            balanceRemaining: String(newBalance),
            penaltiesPaid: String(newPenPaid),
            status: newStatus,
          })
          .where(eq(invoices.invoiceId, inv.invoiceId))
      }
    }

    return NextResponse.json({
      success: true,
      paymentId: payment.paymentId,
      allocation: allocation,
    })
  } catch (error) {
    console.error('Failed to confirm payment:', error)
    return NextResponse.json({ error: 'Failed to confirm payment' }, { status: 500 })
  }
}
```

- [ ] **Step 2: Verify build**

Run: `cd app && npm run build`

- [ ] **Step 3: Commit**

```bash
git add app/src/app/api/pay/confirm/route.ts
git commit -m "feat: enhance payment confirm to create allocation records and update penalties"
```

---

### Task 9: Admin UI — InvoiceBreakdown and PaymentAllocations components

**Files:**
- Create: `app/src/components/receivable/InvoiceBreakdown.tsx`
- Create: `app/src/components/receivable/PaymentAllocations.tsx`
- Modify: Existing `CustomerDetail.tsx` component (integrate new components)

- [ ] **Step 1: Create InvoiceBreakdown component**

Displays invoice cards with aging badges, principal/penalty/paid/balance columns, and a summary bar. Fetches data from `/api/receivable/[id]/breakdown`.

Refer to the mockup in the design spec (Feature 1, Section A). Key elements:
- Aging badge per invoice (color-coded: red 90+, amber 30-60, blue pending)
- 4-column grid per invoice: Principal, Penalty (with "N months × R%"), Paid, Balance
- Summary bar at bottom with totals

- [ ] **Step 2: Create PaymentAllocations component**

Displays payment history with allocation detail. Each payment shows type (PRINCIPAL/PENALTY), target invoice, and amount. Shows "→ INV-XXXX fully settled" when allocation results in zero balance.

- [ ] **Step 3: Integrate into CustomerDetail page**

Find the existing `CustomerDetail.tsx` component (likely `app/src/components/receivable/CustomerDetail.tsx`). Replace the flat invoices table and payment history sections with the new `InvoiceBreakdown` and `PaymentAllocations` components. Pass the `customerId` as a prop; each component fetches its own data from the breakdown API.

- [ ] **Step 4: Verify in browser**

Run: `cd app && npm run dev`

Navigate to a customer detail page. Verify:
- Invoice cards show with penalty breakdown
- Payment history shows allocation detail
- Summary bar shows correct totals

- [ ] **Step 5: Commit**

```bash
git add app/src/components/receivable/InvoiceBreakdown.tsx app/src/components/receivable/PaymentAllocations.tsx
git add app/src/components/receivable/CustomerDetail.tsx
git commit -m "feat: add invoice breakdown and payment allocation components to customer detail"
```

---

### Task 10: Payer portal — BalanceBreakdown and PartialPaymentCalculator

**Files:**
- Create: `app/src/components/pay/BalanceBreakdown.tsx`
- Create: `app/src/components/pay/PartialPaymentCalculator.tsx`
- Modify: `app/src/app/pay/page.tsx`

- [ ] **Step 1: Create BalanceBreakdown component**

Shows the payer all outstanding invoices grouped by month with principal and penalty subtotals. Takes `customerId` prop, fetches from `/api/receivable/[customerId]/breakdown`. Shows total amount due with principal/penalty split. Has "Pay Full Amount" and "Partial Payment" buttons.

- [ ] **Step 2: Create PartialPaymentCalculator component**

Input field for payment amount. On change (debounced 500ms), calls `POST /api/pay/preview` with `{ customerId, amount }`. Shows two sections:
- "How your payment will be applied" (green, checkmark) — lists allocations
- "Still outstanding" (red, warning) — lists remaining
- Warning: "Remaining balance of ₱X will continue to accrue penalties at Y%/month"

- [ ] **Step 3: Integrate into pay page**

Modify `app/src/app/pay/page.tsx` to show `BalanceBreakdown` after QR token verification (needs the customerId from the meta response). When payer selects partial payment, show `PartialPaymentCalculator`.

Note: The `/api/pay/meta` response needs to include `customerId` — check if it already does. If not, add it.

- [ ] **Step 4: Verify in browser**

Use the emulator to generate a QR code for an overdue invoice. Open the payment link. Verify:
- Balance breakdown shows with penalties
- Partial payment calculator shows dynamic allocations
- Warning about continued accrual appears

- [ ] **Step 5: Commit**

```bash
git add app/src/components/pay/BalanceBreakdown.tsx app/src/components/pay/PartialPaymentCalculator.tsx
git add app/src/app/pay/page.tsx
git commit -m "feat: add balance breakdown and partial payment calculator to payer portal"
```

---

### Task 11: Penalty settings UI

**Files:**
- Create: `app/src/components/settings/PenaltySettings.tsx`
- Modify: `app/src/components/layout/Sidebar.tsx`

- [ ] **Step 1: Create PenaltySettings component**

Form with: penalty rate (numeric), grace period (numeric), application method toggle (two cards: "Penalties First / Landlord-friendly" selected vs "FIFO / Payer-friendly"). Fetches current config from `GET /api/penalty-config`, saves via `PUT /api/penalty-config`.

- [ ] **Step 2: Add to Sidebar settings area**

The Sidebar already has a settings section (gear icon with seed button). Add the PenaltySettings component below the existing seed button, or in a collapsible "Penalty Config" section.

- [ ] **Step 3: Verify in browser**

Open settings. Change penalty rate. Save. Verify rate persists on page reload.

- [ ] **Step 4: Commit**

```bash
git add app/src/components/settings/PenaltySettings.tsx app/src/components/layout/Sidebar.tsx
git commit -m "feat: add penalty configuration settings UI"
```

---

## Phase 3: Feature 2 — AP Supplier Workflow

### Task 12: Claims API routes

**Files:**
- Create: `app/src/app/api/payable/claims/route.ts`
- Create: `app/src/app/api/payable/claims/[id]/upload/route.ts`
- Create: `app/src/app/api/payable/claims/[id]/approve/route.ts`
- Create: `app/src/app/api/payable/claims/[id]/reject/route.ts`
- Create: `app/src/app/api/payable/claims/[id]/timeline/route.ts`

**Auth pattern:** The top-level `claims/route.ts` can use `withAuth()` since it has no dynamic params. All `[id]` routes must use `verifyToken` directly (same as Task 7's breakdown route), because `withAuth()` only forwards `(request, user)` and drops the `params` context that Next.js passes as the second argument.

- [ ] **Step 1: Create claims list/submit route (GET/POST)**

`GET /api/payable/claims` — Uses `withAuth()`. Lists supplier invoices with workflow status, joined with suppliers and POs. Supports query params: `status`, `supplierId`.

`POST /api/payable/claims` — Uses `withAuth()`. Creates a new supplier invoice with `workflowStatus: 'SUBMITTED'` and fires a `CLAIM_SUBMITTED` event to `ap_workflow_events_col`. Body: `{ supplierId, poId, invoiceNumber, amount }`.

- [ ] **Step 2: Create upload route**

`POST /api/payable/claims/[id]/upload` — Uses `verifyToken` + `params` pattern. Accepts multipart form with file. Stores base64 in `claimDocumentUrl` on the supplier invoice. Fires `DELIVERY_REPORT_UPLOADED` event. Updates workflow status.

```typescript
// Pattern for all [id] routes:
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await verifyToken(request)
  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }
  const { id } = await params
  const supplierInvoiceId = parseInt(id, 10)
  // ... handler logic
}
```

- [ ] **Step 3: Create approve route**

`POST /api/payable/claims/[id]/approve` — Uses `verifyToken` + `params` pattern. Body: `{ role: 'AP_CLERK' | 'FINANCE_MANAGER' }`. AP Clerk approval sets status to `AP_APPROVED`, fires `AP_CLERK_APPROVED` event. FM approval sets status to `FM_APPROVED`, fires `FM_APPROVED` event, then auto-fires `PAYMENT_SCHEDULED` and `PAYMENT_RELEASED` events with short delays (for demo effect).

- [ ] **Step 4: Create reject route**

`POST /api/payable/claims/[id]/reject` — Uses `verifyToken` + `params` pattern. Body: `{ role, notes }`. Sets status to `REJECTED`, fires `AP_CLERK_REJECTED` or `FM_REJECTED` event with notes.

- [ ] **Step 5: Create timeline route**

`GET /api/payable/claims/[id]/timeline` — Uses `verifyToken` + `params` pattern. Returns all `ap_workflow_events_col` rows for the given `supplierInvoiceId`, ordered by `createdAt ASC`. Also includes "future steps" based on current workflow status.

- [ ] **Step 6: Verify build**

Run: `cd app && npm run build`

- [ ] **Step 7: Commit**

```bash
git add app/src/app/api/payable/claims/
git commit -m "feat: add AP claims API routes (list, submit, upload, approve, reject, timeline)"
```

---

### Task 13: Workflow Timeline component

**Files:**
- Create: `app/src/components/payable/WorkflowTimeline.tsx`

- [ ] **Step 1: Create reusable timeline component**

Props: `supplierInvoiceId: number`. Fetches from `GET /api/payable/claims/[id]/timeline`.

Renders a vertical timeline with:
- Green dots for completed events (with description, performer, timestamp)
- Amber pulsing dot for current/waiting step
- Grey dots for future steps
- Vertical line with green → amber → grey gradient

The component maps event types to human-readable labels:
- `CLAIM_SUBMITTED` → "Claim Submitted"
- `DELIVERY_REPORT_UPLOADED` → "Delivery Report Uploaded"
- `GR_CONFIRMED` → "Goods Receipt Confirmed"
- `THREE_WAY_MATCH` → "3-Way Match Verified"
- `AP_CLERK_APPROVED` → "AP Clerk Approved"
- `FM_APPROVED` → "Finance Manager Approved"
- `PAYMENT_SCHEDULED` → "Payment Scheduled"
- `PAYMENT_RELEASED` → "Payment Released"

- [ ] **Step 2: Verify build**

Run: `cd app && npm run build`

- [ ] **Step 3: Commit**

```bash
git add app/src/components/payable/WorkflowTimeline.tsx
git commit -m "feat: add reusable workflow timeline component"
```

---

### Task 14: AP Approval Queue

**Files:**
- Create: `app/src/components/payable/ApprovalQueue.tsx`
- Modify: `app/src/app/payable/page.tsx`

- [ ] **Step 1: Create ApprovalQueue component**

Tabs: "Pending My Review", "All Claims", "Released". Each claim card shows: invoice number, supplier name, amount, PO number, GR status, 3-way match status, workflow status badge. Action buttons based on simulated role (AP Clerk vs FM — toggled via a dropdown at the top of the queue).

"View Timeline" button opens a dialog/modal with the `WorkflowTimeline` component.

- [ ] **Step 2: Integrate into payable page**

Add an "Approval Queue" tab or section to the existing payable page at `app/src/app/payable/page.tsx`.

- [ ] **Step 3: Verify in browser**

Navigate to Payables. Verify:
- Approval queue shows seeded claims at various stages
- Approve/Reject buttons work and update status
- Timeline dialog shows correct event history

- [ ] **Step 4: Commit**

```bash
git add app/src/components/payable/ApprovalQueue.tsx app/src/app/payable/page.tsx
git commit -m "feat: add AP approval queue with role-based actions"
```

---

### Task 15: Supplier Emulator Mode

**Files:**
- Create: `app/src/components/emulator/EmulatorModeSwitcher.tsx`
- Create: `app/src/components/emulator/SupplierEmulator.tsx`
- Modify: `app/src/components/emulator/CustomerEmulator.tsx`

- [ ] **Step 1: Create EmulatorModeSwitcher**

A tab bar at the top of the emulator panel: "Payer" | "Supplier". Dispatches `setEmulatorMode` Redux action. Renders `CustomerEmulator` or `SupplierEmulator` based on mode.

- [ ] **Step 2: Create SupplierEmulator**

- Supplier dropdown (fetches from `GET /api/payable?limit=100` or dedicated supplier list)
- PO dropdown (filtered by selected supplier)
- Action buttons: Submit Claim, Upload Delivery Report, Check Payment Status
  - Submit Claim → `POST /api/payable/claims`
  - Upload → `POST /api/payable/claims/[id]/upload`
  - Check Status → opens timeline dialog
- Recent submissions list at bottom

- [ ] **Step 3: Modify CustomerEmulator to wrap with mode switcher**

Replace the root of `CustomerEmulator.tsx` to include `EmulatorModeSwitcher` at the top, which conditionally renders either the existing payer content or the `SupplierEmulator`.

- [ ] **Step 4: Verify in browser**

Open emulator. Switch to Supplier mode. Select a supplier and PO. Submit a claim. Upload a document. Check payment status (timeline should show).

- [ ] **Step 5: Commit**

```bash
git add app/src/components/emulator/EmulatorModeSwitcher.tsx app/src/components/emulator/SupplierEmulator.tsx
git add app/src/components/emulator/CustomerEmulator.tsx
git commit -m "feat: add supplier mode to emulator with claim submission and timeline"
```

---

## Phase 4: Feature 3 — Document AI Viewer

### Task 16: DocumentViewer component

**Files:**
- Create: `app/src/components/documents/DocumentViewer.tsx`

- [ ] **Step 1: Create side-by-side document viewer**

Props: `documentId: number` (or full `DocumentViewerData` object).

If given `documentId`, fetches from `GET /api/documents?documentId=[id]` (or add a `GET /api/documents/[id]` route if needed).

**Left column:**
- Renders the image from `fileUrl` (base64 data URI or URL)
- Extracted field legend below the image, color-keyed to right column
- Zoom (CSS transform) and download controls

**Right column:**
- Overall confidence score (calculated from validation result — count of passing checks / total checks × 100, color-coded)
- Each extracted field from `ocrResult` as a card:
  - Field name, extracted value
  - Match indicator dot (green/red/blue) based on `validationResult.checks[]` entries
  - For mismatches: explanation text from the validation check
- Action buttons:
  - All match: "Confirm Payment" (green) + "Flag for Review"
  - Mismatch: "Accept as Partial" (amber) + "Escalate" (red)

Refer to the mockup in the design spec (Feature 3, Section A).

Note: The existing `ValidationCheck` type has fields `{ check, passed, expected, actual, severity }` (not `field`/`match`). Map `check` → field label, `passed` → green/red indicator, `severity` → ordering. The `validationResult` jsonb has structure `{ checks: ValidationCheck[], overallStatus }`. Use the actual type field names from `app/src/types/index.ts`.

- [ ] **Step 2: Verify build**

Run: `cd app && npm run build`

- [ ] **Step 3: Commit**

```bash
git add app/src/components/documents/DocumentViewer.tsx
git commit -m "feat: add side-by-side document viewer with AI analysis"
```

---

### Task 17: Integrate DocumentViewer into access points

**Files:**
- Modify: Customer detail page component (payment history rows)
- Modify: Collections verification page/component
- Modify: AP Approval Queue component (from Task 15)

- [ ] **Step 1: Add "View Document" to payment history in CustomerDetail**

In the payment history section (or the new `PaymentAllocations` component), add a "View Document" button/link on payments that have an associated document. Clicking opens a dialog with `DocumentViewer`. Query documents by `paymentId` to find the associated document.

- [ ] **Step 2: Add DocumentViewer to collections verification**

Find the existing document verification component in `/collections`. Replace or augment the current document display with the `DocumentViewer` component for a richer side-by-side view.

- [ ] **Step 3: Add "View Documents" to ApprovalQueue**

The ApprovalQueue already has a "View Documents" button placeholder. Wire it to open a dialog with `DocumentViewer`, passing the `claimDocumentUrl` from the supplier invoice.

- [ ] **Step 4: Verify in browser**

Test all three access points:
1. Customer detail → payment with document → View Document
2. Collections → document verification
3. Payable → Approval Queue → View Documents on a claim

- [ ] **Step 5: Commit**

```bash
git add app/src/components/receivable/ app/src/components/payable/ApprovalQueue.tsx
git commit -m "feat: integrate document viewer into customer detail, collections, and AP queue"
```

---

## Phase 5: Final Integration

### Task 18: Build verification and polish

- [ ] **Step 1: Full build check**

Run: `cd app && npm run build`

Expected: Clean build with no errors.

- [ ] **Step 2: Lint check**

Run: `cd app && npm run lint`

Fix any lint issues.

- [ ] **Step 3: Run seed and verify all features end-to-end**

Start dev server: `cd app && npm run dev`

1. Trigger reseed via settings UI
2. Navigate to a customer with overdue invoices — verify breakdown
3. Open payment portal via QR — verify penalty display and partial calculator
4. Switch emulator to supplier mode — submit a claim, upload delivery report
5. Navigate to Payable → Approval Queue — approve the claim through both levels
6. View timeline at each stage
7. View a document with AI analysis

- [ ] **Step 4: Commit any remaining fixes**

```bash
git add -A
git commit -m "fix: polish and integration fixes for penalty, AP workflow, and document viewer"
```
