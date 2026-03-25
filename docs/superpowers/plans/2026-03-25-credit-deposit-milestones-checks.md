# Credit, Deposit Forfeiture, Milestones & Check Payments — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add credit/overpayment wallet, security deposit forfeiture with approval, milestone-based AP payments, and check payment method with clearing period.

**Architecture:** Extends the existing ledger pattern. Credit ledger tracks overpayments. Security deposits have auto-flag + approval workflow. Milestones are self-contained per PO with template presets. Check payments add a PENDING_CLEARANCE status with 3-day clearing.

**Tech Stack:** Next.js 16 App Router, Drizzle ORM (pg-proxy), React 19, Redux Toolkit, Tailwind CSS

**Spec:** `docs/superpowers/specs/2026-03-25-credit-deposit-milestones-checks-design.md`

**No test framework is configured.** Verification via `npm run build` and browser testing.

**IMPORTANT: Database Access Pattern**
- Use `db.execute(sql.raw(...))` for SELECT queries on new tables (avoids Drizzle pg-proxy column ordering issues)
- Use Drizzle ORM (`db.insert()`, `db.update()`) for inserts and updates
- Push schema via SQL proxy curl commands (not drizzle-kit push — see CLAUDE.md)
- All dynamic `[id]` routes use `verifyToken` directly (not `withAuth`)

---

## File Map

### New Files

| File | Responsibility |
|------|---------------|
| `app/src/app/api/credit/[customerId]/route.ts` | GET credit balance + ledger history |
| `app/src/app/api/credit/[customerId]/apply/route.ts` | POST apply credit to invoice |
| `app/src/app/api/credit/[customerId]/refund/route.ts` | POST issue refund |
| `app/src/components/receivable/CreditBalanceCard.tsx` | Customer sidebar credit card with apply/refund |
| `app/src/app/api/deposits/[customerId]/route.ts` | GET deposit info + forfeiture history |
| `app/src/app/api/forfeitures/route.ts` | GET list forfeitures with status filter |
| `app/src/app/api/forfeitures/[id]/approve/route.ts` | POST approve forfeiture |
| `app/src/app/api/forfeitures/[id]/reject/route.ts` | POST reject forfeiture |
| `app/src/components/receivable/SecurityDepositCard.tsx` | Customer sidebar deposit card |
| `app/src/components/collections/ForfeitureQueue.tsx` | Forfeiture approval queue |
| `app/src/app/api/milestone-templates/route.ts` | GET/POST milestone templates |
| `app/src/app/api/payable/[id]/milestones/route.ts` | GET/POST milestones for a PO |
| `app/src/app/api/payable/[id]/milestones/[milestoneId]/complete/route.ts` | POST mark milestone complete |
| `app/src/app/api/payable/[id]/milestones/[milestoneId]/pay/route.ts` | POST release milestone payment |
| `app/src/components/payable/MilestoneProgress.tsx` | PO detail milestone visualization |
| `app/src/components/payable/MilestoneTemplates.tsx` | Template management UI |
| `app/src/components/pay/CheckPaymentFlow.tsx` | Check payment steps (details + upload) |
| `app/src/app/api/receivable/payments/[id]/check-action/route.ts` | POST confirm/bounce check |
| `app/src/components/receivable/CheckClearanceCard.tsx` | Check clearance progress in payments list |

### Modified Files

| File | Changes |
|------|---------|
| `app/src/db/schema.ts` | Add 5 new tables, modify customers + invoices + incoming_payments + penalty_config |
| `app/src/lib/seed.ts` | Seed credits, deposits, forfeitures, milestones, check payments |
| `app/src/types/index.ts` | Add types for all 4 features |
| `app/src/lib/payment-allocation.ts` | Add `excessAmount` to AllocationPreview return |
| `app/src/lib/utils.ts` | Add `addBusinessDays()` helper |
| `app/src/app/api/pay/confirm/route.ts` | Handle overpayment → credit, handle CHECK → PENDING_CLEARANCE |
| `app/src/components/receivable/CustomerDetail.tsx` | Add CreditBalanceCard + SecurityDepositCard to sidebar |
| `app/src/components/settings/PenaltySettings.tsx` | Add deposit forfeiture threshold setting |
| `app/src/app/payable/[id]/page.tsx` | Add MilestoneProgress section |
| `app/src/components/emulator/SupplierEmulator.tsx` | Add milestone completion actions |
| `app/src/app/pay/page.tsx` | Add check payment option |
| `app/src/app/collections/page.tsx` | Add ForfeitureQueue tab |

---

## Phase 1: Schema, Types & Seed Foundation

### Task 1: Add new tables and columns to schema

**Files:**
- Modify: `app/src/db/schema.ts`

- [ ] **Step 1: Add credit_ledger_col table**

After the AP workflow section (~line 355), add:

```typescript
// ─── CREDIT & DEPOSITS ───────────────────────────────────────

export const creditLedger = pgTable('credit_ledger_col', {
  entryId: serial('entry_id').primaryKey(),
  customerId: integer('customer_id').notNull().references(() => customers.customerId),
  type: varchar('type', { length: 20 }).notNull(), // CREDIT | DEBIT | REFUND
  amount: decimal('amount', { precision: 12, scale: 2 }).notNull(),
  description: text('description'),
  paymentId: integer('payment_id').references(() => incomingPayments.paymentId),
  invoiceId: integer('invoice_id').references(() => invoices.invoiceId),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => [
  index('idx_credit_ledger_customer_col').on(table.customerId),
])

export const securityDeposits = pgTable('security_deposits_col', {
  depositId: serial('deposit_id').primaryKey(),
  customerId: integer('customer_id').notNull().references(() => customers.customerId).unique(),
  contractId: integer('contract_id').notNull().references(() => contracts.contractId),
  initialAmount: decimal('initial_amount', { precision: 12, scale: 2 }).notNull(),
  currentBalance: decimal('current_balance', { precision: 12, scale: 2 }).notNull(),
  createdAt: timestamp('created_at').defaultNow(),
})

export const depositForfeitures = pgTable('deposit_forfeitures_col', {
  forfeitureId: serial('forfeiture_id').primaryKey(),
  depositId: integer('deposit_id').notNull().references(() => securityDeposits.depositId),
  customerId: integer('customer_id').notNull().references(() => customers.customerId),
  invoiceId: integer('invoice_id').notNull().references(() => invoices.invoiceId),
  amount: decimal('amount', { precision: 12, scale: 2 }).notNull(),
  status: varchar('status', { length: 20 }).notNull().default('FLAGGED'),
  flaggedAt: timestamp('flagged_at').defaultNow(),
  reviewedBy: varchar('reviewed_by', { length: 200 }),
  reviewedAt: timestamp('reviewed_at'),
  notes: text('notes'),
}, (table) => [
  index('idx_forfeitures_customer_col').on(table.customerId),
  index('idx_forfeitures_status_col').on(table.status),
])
```

- [ ] **Step 2: Add milestone tables**

```typescript
// ─── MILESTONES ──────────────────────────────────────────────

export const milestoneTemplates = pgTable('milestone_templates_col', {
  templateId: serial('template_id').primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  milestones: jsonb('milestones').notNull(), // [{ label, percentage }]
  createdAt: timestamp('created_at').defaultNow(),
})

export const poMilestones = pgTable('po_milestones_col', {
  milestoneId: serial('milestone_id').primaryKey(),
  poId: integer('po_id').notNull().references(() => purchaseOrders.poId),
  label: varchar('label', { length: 100 }).notNull(),
  percentage: decimal('percentage', { precision: 5, scale: 2 }).notNull(),
  amount: decimal('amount', { precision: 12, scale: 2 }).notNull(),
  status: varchar('status', { length: 20 }).notNull().default('PENDING'),
  completedAt: timestamp('completed_at'),
  paidAt: timestamp('paid_at'),
  paymentReference: varchar('payment_reference', { length: 100 }),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => [
  index('idx_milestones_po_col').on(table.poId),
])
```

- [ ] **Step 3: Modify existing tables**

Add to `customers` table (before `createdAt`):
```typescript
  creditBalance: decimal('credit_balance', { precision: 12, scale: 2 }).notNull().default('0'),
```

Add to `invoices` table (after `penaltiesPaid`):
```typescript
  depositForfeitureFlag: varchar('deposit_forfeiture_flag', { length: 20 }),
```

Add to `incomingPayments` table (before `status`):
```typescript
  checkNumber: varchar('check_number', { length: 50 }),
  clearanceDate: date('clearance_date'),
```

Add to `penaltyConfig` table (before `updatedAt`):
```typescript
  depositForfeitDays: integer('deposit_forfeit_days').notNull().default(90),
```

- [ ] **Step 4: Push schema to database via SQL proxy**

Run each DDL statement via curl to the SQL proxy (see CLAUDE.md for pattern). Create all 5 new tables, add all new columns to existing tables.

- [ ] **Step 5: Verify build**

Run: `cd /home/josef/projects/mpe-collections-demo/app && npm run build`

- [ ] **Step 6: Commit**

```bash
git add app/src/db/schema.ts
git commit -m "feat: add schema for credit ledger, deposits, milestones, and check fields"
```

---

### Task 2: Add TypeScript types

**Files:**
- Modify: `app/src/types/index.ts`
- Modify: `app/src/lib/payment-allocation.ts`

- [ ] **Step 1: Add types to end of types/index.ts**

```typescript
// ─── Credit & Deposit Types ─────────────────────────────────

export interface CreditLedgerEntry {
  entryId: number
  customerId: number
  type: 'CREDIT' | 'DEBIT' | 'REFUND'
  amount: number
  description: string | null
  paymentId: number | null
  invoiceId: number | null
  createdAt: string
}

export interface SecurityDeposit {
  depositId: number
  customerId: number
  contractId: number
  initialAmount: number
  currentBalance: number
}

export interface DepositForfeiture {
  forfeitureId: number
  depositId: number
  customerId: number
  invoiceId: number
  invoiceNumber?: string
  customerName?: string
  propertyName?: string
  amount: number
  status: 'FLAGGED' | 'APPROVED' | 'REJECTED'
  flaggedAt: string
  reviewedBy: string | null
  reviewedAt: string | null
  notes: string | null
  daysOverdue?: number
  depositBalance?: number
}

// ─── Milestone Types ────────────────────────────────────────

export interface MilestoneTemplate {
  templateId: number
  name: string
  milestones: { label: string; percentage: number }[]
}

export interface POMilestone {
  milestoneId: number
  poId: number
  label: string
  percentage: number
  amount: number
  status: 'PENDING' | 'COMPLETED' | 'PAID'
  completedAt: string | null
  paidAt: string | null
  paymentReference: string | null
  sortOrder: number
}

// ─── Check Payment Types ────────────────────────────────────

export type PaymentStatus = 'PENDING' | 'CONFIRMED' | 'FAILED' | 'PENDING_CLEARANCE' | 'BOUNCED'
```

- [ ] **Step 2: Add excessAmount to AllocationPreview and depositForfeitDays to PenaltyConfig**

In `app/src/types/index.ts`, find the `AllocationPreview` interface and add:

```typescript
  excessAmount: number
```

Also find the `PenaltyConfig` interface and add:

```typescript
  depositForfeitDays: number
```

- [ ] **Step 3: Update calculateAllocation() to return excessAmount**

In `app/src/lib/payment-allocation.ts`, at the end of the function (in the return statement), add:

```typescript
    excessAmount: Math.max(0, remaining),
```

The `remaining` variable already tracks unspent payment amount.

- [ ] **Step 4: Add addBusinessDays to utils.ts**

In `app/src/lib/utils.ts`, add:

```typescript
export function addBusinessDays(date: Date, days: number): Date {
  const result = new Date(date)
  let added = 0
  while (added < days) {
    result.setDate(result.getDate() + 1)
    const dow = result.getDay()
    if (dow !== 0 && dow !== 6) added++
  }
  return result
}
```

- [ ] **Step 5: Verify build**

Run: `cd /home/josef/projects/mpe-collections-demo/app && npm run build`

- [ ] **Step 6: Commit**

```bash
git add app/src/types/index.ts app/src/lib/payment-allocation.ts app/src/lib/utils.ts
git commit -m "feat: add types for credit, deposits, milestones, checks and excessAmount"
```

---

### Task 3: Update seed function

**Files:**
- Modify: `app/src/lib/seed.ts`

- [ ] **Step 1: Add imports for new schema tables**

Add to the import from `@/db/schema`:

```typescript
creditLedger, securityDeposits, depositForfeitures, milestoneTemplates, poMilestones,
```

- [ ] **Step 2: Add new tables to TRUNCATE statement**

In the single TRUNCATE statement, add the 5 new tables at the beginning of the list:

```sql
credit_ledger_col, security_deposits_col, deposit_forfeitures_col, milestone_templates_col, po_milestones_col,
```

- [ ] **Step 3: Add ALTER TABLE / CREATE TABLE for new columns**

In the idempotent ALTER TABLE section, add:

```sql
ALTER TABLE customers_col ADD COLUMN IF NOT EXISTS credit_balance DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE invoices_col ADD COLUMN IF NOT EXISTS deposit_forfeiture_flag VARCHAR(20);
ALTER TABLE incoming_payments_col ADD COLUMN IF NOT EXISTS check_number VARCHAR(50);
ALTER TABLE incoming_payments_col ADD COLUMN IF NOT EXISTS clearance_date DATE;
ALTER TABLE penalty_config_col ADD COLUMN IF NOT EXISTS deposit_forfeit_days INTEGER NOT NULL DEFAULT 90;
```

- [ ] **Step 4: Seed security deposits for all tenants**

After the existing ML/penalty seed steps, add:

```typescript
// ── 20. Security Deposits ──
console.log('Seeding security deposits...')
const allContracts = await db.execute(sql.raw(
  `SELECT contract_id, customer_id, monthly_amount FROM contracts_col WHERE type = 'LEASE' LIMIT 50`
))
const contractRows = allContracts as unknown as { contract_id: number; customer_id: number; monthly_amount: string }[]
const depositValues = contractRows.map(c => ({
  customerId: c.customer_id,
  contractId: c.contract_id,
  initialAmount: String(Number(c.monthly_amount) * 3),
  currentBalance: String(Number(c.monthly_amount) * 3),
}))
if (depositValues.length > 0) {
  await db.insert(securityDeposits).values(depositValues)
}
console.log(`  ${depositValues.length} security deposits seeded`)
```

- [ ] **Step 5: Seed deposit forfeitures (4 demo scenarios)**

```typescript
// ── 21. Deposit Forfeitures (4 spec scenarios) ──
console.log('Seeding deposit forfeitures...')

// Scenario 1: Already forfeited (150+ days overdue, approved)
const scenario1 = await db.execute(sql.raw(`
  SELECT i.invoice_id, i.customer_id, i.amount, i.due_date,
         sd.deposit_id, sd.current_balance
  FROM invoices_col i
  JOIN security_deposits_col sd ON sd.customer_id = i.customer_id
  WHERE i.status IN ('OVERDUE', 'PARTIAL')
    AND i.due_date < CURRENT_DATE - INTERVAL '150 days'
    AND sd.current_balance > 0
  ORDER BY i.due_date ASC LIMIT 1
`))
const s1 = (scenario1 as unknown as any[])[0]
if (s1) {
  const amt = Math.min(Number(s1.amount), Number(s1.current_balance))
  await db.insert(depositForfeitures).values({
    depositId: s1.deposit_id, customerId: s1.customer_id, invoiceId: s1.invoice_id,
    amount: String(amt), status: 'APPROVED',
    flaggedAt: new Date(s1.due_date),
    reviewedBy: 'admin@ayalaland.com', reviewedAt: new Date(),
    notes: 'Auto-flagged and approved — 150+ days overdue',
  })
  await db.execute(sql.raw(`UPDATE security_deposits_col SET current_balance = current_balance - ${amt} WHERE deposit_id = ${s1.deposit_id}`))
  await db.execute(sql.raw(`UPDATE invoices_col SET deposit_forfeiture_flag = 'FORFEITED' WHERE invoice_id = ${s1.invoice_id}`))

  // Scenario 2: Same customer, different invoice, FLAGGED (90-120 days overdue)
  const scenario2 = await db.execute(sql.raw(`
    SELECT i.invoice_id, i.amount, i.due_date FROM invoices_col i
    WHERE i.customer_id = ${s1.customer_id}
      AND i.status IN ('OVERDUE', 'PARTIAL')
      AND i.due_date < CURRENT_DATE - INTERVAL '90 days'
      AND i.invoice_id != ${s1.invoice_id}
    ORDER BY i.due_date ASC LIMIT 1
  `))
  const s2 = (scenario2 as unknown as any[])[0]
  if (s2) {
    const updatedDeposit = await db.execute(sql.raw(`SELECT current_balance FROM security_deposits_col WHERE deposit_id = ${s1.deposit_id}`))
    const curBal = Number((updatedDeposit as unknown as any[])[0]?.current_balance || 0)
    const amt2 = Math.min(Number(s2.amount), curBal)
    if (amt2 > 0) {
      await db.insert(depositForfeitures).values({
        depositId: s1.deposit_id, customerId: s1.customer_id, invoiceId: s2.invoice_id,
        amount: String(amt2), status: 'FLAGGED', flaggedAt: new Date(),
      })
      await db.execute(sql.raw(`UPDATE invoices_col SET deposit_forfeiture_flag = 'FLAGGED' WHERE invoice_id = ${s2.invoice_id}`))
    }
  }
}

// Scenario 3: Near threshold (60-85 days overdue, NOT flagged — just exists for demo narrative)
// No forfeiture record needed — the invoice is just overdue but below the 90-day threshold

// Scenario 4: Deposit exhausted — find a different customer with small deposit, fully forfeit it
const scenario4 = await db.execute(sql.raw(`
  SELECT sd.deposit_id, sd.customer_id, sd.current_balance,
         i.invoice_id, i.amount
  FROM security_deposits_col sd
  JOIN invoices_col i ON i.customer_id = sd.customer_id
  WHERE sd.current_balance > 0
    AND i.status IN ('OVERDUE', 'PARTIAL')
    AND i.due_date < CURRENT_DATE - INTERVAL '90 days'
    AND sd.customer_id != ${s1?.customer_id || 0}
  ORDER BY sd.current_balance ASC LIMIT 1
`))
const s4 = (scenario4 as unknown as any[])[0]
if (s4) {
  await db.insert(depositForfeitures).values({
    depositId: s4.deposit_id, customerId: s4.customer_id, invoiceId: s4.invoice_id,
    amount: s4.current_balance, status: 'APPROVED',
    flaggedAt: new Date(), reviewedBy: 'admin@ayalaland.com', reviewedAt: new Date(),
    notes: 'Full deposit exhaustion',
  })
  await db.execute(sql.raw(`UPDATE security_deposits_col SET current_balance = 0 WHERE deposit_id = ${s4.deposit_id}`))
  await db.execute(sql.raw(`UPDATE invoices_col SET deposit_forfeiture_flag = 'FORFEITED' WHERE invoice_id = ${s4.invoice_id}`))
}

console.log('  Deposit forfeitures seeded (4 scenarios)')
```

- [ ] **Step 6: Seed credit ledger entries**

```typescript
// ── 22. Credit Ledger (overpayments) ──
console.log('Seeding credit ledger...')
// Pick 2 customers with PAID invoices to give them overpayment credits
const paidCustomers = await db.execute(sql.raw(`
  SELECT DISTINCT i.customer_id, i.invoice_id, i.invoice_number
  FROM invoices_col i WHERE i.status = 'PAID'
  LIMIT 2
`))
const creditCustomers = paidCustomers as unknown as { customer_id: number; invoice_id: number; invoice_number: string }[]

for (const c of creditCustomers) {
  const creditAmt = randInt(3000, 8000)
  await db.insert(creditLedger).values({
    customerId: c.customer_id,
    type: 'CREDIT',
    amount: String(creditAmt),
    description: `Overpayment on ${c.invoice_number}`,
    paymentId: null,
    invoiceId: c.invoice_id,
  })
  await db.execute(sql.raw(
    `UPDATE customers_col SET credit_balance = ${creditAmt} WHERE customer_id = ${c.customer_id}`
  ))
}
console.log(`  ${creditCustomers.length} credit entries seeded`)
```

- [ ] **Step 7: Seed milestone templates and PO milestones**

```typescript
// ── 23. Milestone Templates ──
console.log('Seeding milestone templates...')
const templates = [
  { name: 'Standard 20/40/40', milestones: [{ label: 'Initial Delivery', percentage: 20 }, { label: 'Upon Delivery', percentage: 40 }, { label: 'Completion', percentage: 40 }] },
  { name: 'Equal Split 50/50', milestones: [{ label: 'Upon Delivery', percentage: 50 }, { label: 'Completion', percentage: 50 }] },
  { name: 'Full on Completion', milestones: [{ label: 'Completion', percentage: 100 }] },
]
for (const t of templates) {
  await db.insert(milestoneTemplates).values({ name: t.name, milestones: t.milestones })
}
console.log('  3 milestone templates seeded')

// ── 24. PO Milestones ──
console.log('Seeding PO milestones...')
const allPOs = await db.execute(sql.raw(
  `SELECT po_id, total_amount, status FROM purchase_orders_col ORDER BY po_id`
))
const poRows = allPOs as unknown as { po_id: number; total_amount: string; status: string }[]
const standardTemplate = templates[0].milestones
let msCount = 0

for (let i = 0; i < poRows.length; i++) {
  if (rand() > 0.3) continue // ~30% of POs get milestones
  const po = poRows[i]
  const total = Number(po.total_amount)

  for (let m = 0; m < standardTemplate.length; m++) {
    const ms = standardTemplate[m]
    const amount = Math.round(total * ms.percentage / 100 * 100) / 100
    let status = 'PENDING'
    let completedAt = null as Date | null
    let paidAt = null as Date | null
    let paymentRef = null as string | null

    if (po.status === 'CLOSED') {
      status = 'PAID'
      completedAt = new Date('2026-02-01')
      paidAt = new Date('2026-02-15')
      paymentRef = `REF-MS-${po.po_id}-${m + 1}`
    } else if (po.status === 'RECEIVED' && m === 0) {
      status = 'PAID'
      completedAt = new Date('2026-01-15')
      paidAt = new Date('2026-01-20')
      paymentRef = `REF-MS-${po.po_id}-1`
    } else if (po.status === 'RECEIVED' && m === 1) {
      status = 'COMPLETED'
      completedAt = new Date('2026-03-10')
    }

    await db.insert(poMilestones).values({
      poId: po.po_id,
      label: ms.label,
      percentage: String(ms.percentage),
      amount: String(amount),
      status,
      completedAt,
      paidAt,
      paymentReference: paymentRef,
      sortOrder: m,
    })
    msCount++
  }
}
console.log(`  ${msCount} PO milestones seeded`)
```

- [ ] **Step 8: Seed check payments**

```typescript
// ── 25. Check Payments ──
console.log('Seeding check payments...')
const paidInvoices = await db.execute(sql.raw(`
  SELECT i.invoice_id, i.customer_id, i.amount, i.invoice_number
  FROM invoices_col i WHERE i.status = 'PAID'
  ORDER BY i.invoice_id DESC LIMIT 4
`))
const checkInvoices = paidInvoices as unknown as { invoice_id: number; customer_id: number; amount: string; invoice_number: string }[]

const checkStatuses = ['PENDING_CLEARANCE', 'PENDING_CLEARANCE', 'CONFIRMED', 'BOUNCED']
const checkDaysAgo = [1, 2, 5, 3]

for (let i = 0; i < Math.min(checkInvoices.length, 4); i++) {
  const inv = checkInvoices[i]
  const depositDate = new Date()
  depositDate.setDate(depositDate.getDate() - checkDaysAgo[i])
  const clearDate = new Date(depositDate)
  clearDate.setDate(clearDate.getDate() + 3) // simplified, not business days for seed

  await db.insert(incomingPayments).values({
    invoiceId: inv.invoice_id,
    customerId: inv.customer_id,
    amount: inv.amount,
    paymentMethod: 'CHECK',
    paymentDate: depositDate,
    checkNumber: `CHK-${1000 + i}`,
    clearanceDate: fmtDate(clearDate),
    status: checkStatuses[i],
    confirmedAt: checkStatuses[i] === 'CONFIRMED' ? new Date() : null,
  })
}
console.log('  Check payments seeded')
```

- [ ] **Step 9: Verify build and commit**

Run: `cd /home/josef/projects/mpe-collections-demo/app && npm run build`

```bash
git add app/src/lib/seed.ts
git commit -m "feat: seed credit, deposits, forfeitures, milestones, and check payments"
```

---

## Phase 2: Feature 1 — Credit Balance & Overpayment

### Task 4: Credit API routes

**Files:**
- Create: `app/src/app/api/credit/[customerId]/route.ts`
- Create: `app/src/app/api/credit/[customerId]/apply/route.ts`
- Create: `app/src/app/api/credit/[customerId]/refund/route.ts`

- [ ] **Step 1: Create GET /api/credit/[customerId]**

Returns credit balance and ledger history using parameterized raw SQL (never interpolate user input directly into sql.raw — always use `parseInt` + validate `isNaN` first):

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth-middleware'
import { db } from '@/db'
import { sql } from 'drizzle-orm'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ customerId: string }> }
) {
  const user = await verifyToken(request)
  if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })

  const { customerId } = await params
  const cid = parseInt(customerId, 10)
  if (isNaN(cid)) return NextResponse.json({ error: 'Invalid customer ID' }, { status: 400 })

  // Use sql template (not sql.raw) for parameterized queries where possible
  const balanceResult = await db.execute(
    sql`SELECT credit_balance FROM customers_col WHERE customer_id = ${cid}`
  )
  const balanceRows = balanceResult as unknown as { credit_balance: string }[]
  if (!balanceRows.length) return NextResponse.json({ error: 'Customer not found' }, { status: 404 })

  const ledgerResult = await db.execute(
    sql`SELECT entry_id, customer_id, type, amount, description, payment_id, invoice_id, created_at
     FROM credit_ledger_col WHERE customer_id = ${cid} ORDER BY created_at DESC`
  )
  const entries = (ledgerResult as unknown as any[]).map(r => ({
    entryId: r.entry_id, customerId: r.customer_id, type: r.type,
    amount: Number(r.amount), description: r.description,
    paymentId: r.payment_id, invoiceId: r.invoice_id,
    createdAt: String(r.created_at),
  }))

  return NextResponse.json({
    creditBalance: Number(balanceRows[0].credit_balance),
    entries,
  })
}
```

**IMPORTANT: SQL safety pattern for all routes in this plan.** Use `sql` template literals (parameterized) instead of `sql.raw()` with string interpolation for any query involving user-supplied values. `sql.raw()` is only safe for queries with hardcoded/validated integer IDs (always `parseInt` + `isNaN` check first). Prefer `sql` template over `sql.raw` when the Drizzle driver supports it.

- [ ] **Step 2: Create POST /api/credit/[customerId]/apply**

Applies credit to an invoice (creates DEBIT entry, reduces invoice balance and credit balance).

- [ ] **Step 3: Create POST /api/credit/[customerId]/refund**

Creates REFUND entry, reduces credit balance.

- [ ] **Step 4: Verify build and commit**

```bash
git add app/src/app/api/credit/
git commit -m "feat: add credit ledger API routes (get, apply, refund)"
```

---

### Task 5: Enhance payment confirm for overpayment detection

**Files:**
- Modify: `app/src/app/api/pay/confirm/route.ts`

- [ ] **Step 1: Add credit ledger import, overpayment handling, and CHECK method support**

The confirm route currently hardcodes `paymentMethod: 'CARD'` and requires a Stripe `paymentIntentId`. It needs to accept an optional `paymentMethod` field in the request body to support CHECK payments.

Changes to make:

1. Accept `paymentMethod` from request body (default to `'CARD'` for backwards compat)
2. Only verify Stripe payment if `paymentMethod !== 'CHECK'`
3. For CHECK payments: set status to `'PENDING_CLEARANCE'`, store `checkNumber` and `clearanceDate`, skip allocation (allocation runs when admin confirms clearance later)
4. For CARD payments: existing Stripe flow + overpayment detection

```typescript
import { creditLedger } from '@/db/schema'
import { addBusinessDays } from '@/lib/utils'

// At top of POST handler, extract paymentMethod:
const { paymentIntentId, invoiceId, customerId, amount, paymentMethod = 'CARD', checkNumber } = body

// Stripe verification — skip for CHECK:
if (paymentMethod !== 'CHECK') {
  if (!paymentIntentId) {
    return NextResponse.json({ error: 'paymentIntentId is required' }, { status: 400 })
  }
  const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId)
  if (paymentIntent.status !== 'succeeded') {
    return NextResponse.json({ error: `Payment not succeeded` }, { status: 400 })
  }
}

// For CHECK: create payment with PENDING_CLEARANCE, skip allocation
if (paymentMethod === 'CHECK') {
  const clearanceDate = addBusinessDays(new Date(), 3)
  const [payment] = await db.insert(incomingPayments).values({
    invoiceId: invoiceId || null,
    customerId: cid,
    amount: String(amount),
    paymentMethod: 'CHECK',
    checkNumber: checkNumber || null,
    clearanceDate: clearanceDate.toISOString().split('T')[0],
    status: 'PENDING_CLEARANCE',
  }).returning()
  return NextResponse.json({ success: true, paymentId: payment.paymentId, status: 'PENDING_CLEARANCE', clearanceDate })
}

// For CARD: existing allocation flow...
// After allocations are written, check for overpayment:
if (allocation.excessAmount > 0) {
  await db.insert(creditLedger).values({
    customerId: cid,
    type: 'CREDIT',
    amount: String(allocation.excessAmount),
    description: `Overpayment — ₱${allocation.excessAmount.toFixed(2)} excess`,
    paymentId: payment.paymentId,
  })
  await db.execute(
    sql`UPDATE customers_col SET credit_balance = credit_balance + ${allocation.excessAmount} WHERE customer_id = ${cid}`
  )
}
```

- [ ] **Step 2: Verify build and commit**

```bash
git add app/src/app/api/pay/confirm/route.ts
git commit -m "feat: handle overpayment credit and check payment PENDING_CLEARANCE in confirm"
```

---

### Task 6: Credit Balance UI

**Files:**
- Create: `app/src/components/receivable/CreditBalanceCard.tsx`
- Modify: `app/src/components/receivable/CustomerDetail.tsx`

- [ ] **Step 1: Create CreditBalanceCard component**

Props: `{ customerId: number }`. Fetches from `GET /api/credit/${customerId}`. Shows credit balance, history, Apply to Invoice button (dialog listing outstanding invoices), Refund button.

- [ ] **Step 2: Integrate into CustomerDetail sidebar**

Add `<CreditBalanceCard customerId={...} />` to the sidebar section of CustomerDetail, alongside existing ML score cards.

- [ ] **Step 3: Verify build and commit**

```bash
git add app/src/components/receivable/CreditBalanceCard.tsx app/src/components/receivable/CustomerDetail.tsx
git commit -m "feat: add credit balance card to customer detail"
```

---

## Phase 3: Feature 2 — Security Deposit Forfeiture

### Task 7: Deposit and forfeiture API routes

**Files:**
- Create: `app/src/app/api/deposits/[customerId]/route.ts`
- Create: `app/src/app/api/forfeitures/route.ts`
- Create: `app/src/app/api/forfeitures/[id]/approve/route.ts`
- Create: `app/src/app/api/forfeitures/[id]/reject/route.ts`

- [ ] **Step 1: Create GET /api/deposits/[customerId]**

Returns deposit info and forfeiture history using raw SQL. Uses `verifyToken`.

- [ ] **Step 2: Create GET /api/forfeitures**

Uses `withAuth`. Lists all forfeitures joined with customers, invoices, deposits. Supports `?status=FLAGGED` filter. Returns `DepositForfeiture[]` with customer name, property, invoice number, days overdue, deposit balance.

- [ ] **Step 3: Create POST /api/forfeitures/[id]/approve**

Uses `verifyToken`. Sets status to APPROVED, reduces deposit `currentBalance`, updates invoice `depositForfeitureFlag` to 'FORFEITED', optionally reduces invoice `balanceRemaining`. Body: `{ amount?, notes? }`.

- [ ] **Step 4: Create POST /api/forfeitures/[id]/reject**

Uses `verifyToken`. Sets status to REJECTED, clears invoice `depositForfeitureFlag`. Body: `{ notes }`.

- [ ] **Step 5: Verify build and commit**

```bash
git add app/src/app/api/deposits/ app/src/app/api/forfeitures/
git commit -m "feat: add deposit info and forfeiture approval API routes"
```

---

### Task 8: Security Deposit Card and Forfeiture Queue UI

**Files:**
- Create: `app/src/components/receivable/SecurityDepositCard.tsx`
- Create: `app/src/components/collections/ForfeitureQueue.tsx`
- Modify: `app/src/components/receivable/CustomerDetail.tsx`
- Modify: `app/src/components/settings/PenaltySettings.tsx`
- Modify: `app/src/app/collections/page.tsx`

- [ ] **Step 1: Create SecurityDepositCard**

Props: `{ customerId: number }`. Fetches from `GET /api/deposits/${customerId}`. Shows initial/current/forfeited amounts, forfeiture history log, "Apply from Deposit" manual action button.

- [ ] **Step 2: Create ForfeitureQueue**

Fetches from `GET /api/forfeitures`. Tabs: Pending Approval, Approved, Rejected. Each card shows customer, invoice, amount, days overdue, deposit balance. Approve/Reject/Manual Amount buttons.

- [ ] **Step 3: Add SecurityDepositCard to CustomerDetail**

Add below the CreditBalanceCard in the sidebar.

- [ ] **Step 4: Add deposit forfeit threshold to PenaltySettings**

Add a "Deposit Forfeiture" section with "Auto-flag after (days overdue)" input. Read/write via the existing penalty config API (which now has `depositForfeitDays`).

- [ ] **Step 5: Add ForfeitureQueue to collections page**

Add as a new tab alongside existing collections content.

- [ ] **Step 6: Verify build and commit**

```bash
git add app/src/components/receivable/SecurityDepositCard.tsx app/src/components/collections/ForfeitureQueue.tsx
git add app/src/components/receivable/CustomerDetail.tsx app/src/components/settings/PenaltySettings.tsx
git add app/src/app/collections/page.tsx
git commit -m "feat: add security deposit card, forfeiture queue, and settings"
```

---

## Phase 4: Feature 3 — Milestone Payments

### Task 9: Milestone API routes

**Files:**
- Create: `app/src/app/api/milestone-templates/route.ts`
- Create: `app/src/app/api/payable/[id]/milestones/route.ts`
- Create: `app/src/app/api/payable/[id]/milestones/[milestoneId]/complete/route.ts`
- Create: `app/src/app/api/payable/[id]/milestones/[milestoneId]/pay/route.ts`

- [ ] **Step 1: Create GET/POST /api/milestone-templates**

Uses `withAuth`. GET returns all templates. POST creates new template (validates percentages sum to 100).

- [ ] **Step 2: Create GET/POST /api/payable/[id]/milestones**

Uses `verifyToken`. GET returns milestones for a PO. POST assigns milestones from template (looks up template, calculates amounts from PO total, inserts milestone rows).

- [ ] **Step 3: Create POST .../[milestoneId]/complete**

Uses `verifyToken`. Sets milestone status to COMPLETED, sets completedAt.

- [ ] **Step 4: Create POST .../[milestoneId]/pay**

Uses `verifyToken`. Sets milestone status to PAID, sets paidAt and paymentReference.

- [ ] **Step 5: Verify build and commit**

```bash
git add app/src/app/api/milestone-templates/ app/src/app/api/payable/\[id\]/milestones/
git commit -m "feat: add milestone template and PO milestone API routes"
```

---

### Task 10: Milestone UI components

**Files:**
- Create: `app/src/components/payable/MilestoneProgress.tsx`
- Create: `app/src/components/payable/MilestoneTemplates.tsx`
- Modify: `app/src/app/payable/[id]/page.tsx` or the SupplierDetail component
- Modify: `app/src/components/emulator/SupplierEmulator.tsx`

- [ ] **Step 1: Create MilestoneProgress component**

Props: `{ poId: number, poTotal: number }`. Fetches from `GET /api/payable/${poId}/milestones`. Shows stacked progress bar (green=PAID, amber=COMPLETED, grey=PENDING), milestone cards with left color border, "Release Payment" button on COMPLETED milestones, summary bar.

- [ ] **Step 2: Create MilestoneTemplates component**

Shows template list with percentage bars. "New Template" button. Used in a payable settings area.

- [ ] **Step 3: Integrate MilestoneProgress into SupplierDetail component**

The page at `/payable/[id]` renders `<SupplierDetail>`, which shows the supplier info and their POs. Find the SupplierDetail component (likely `app/src/components/payable/SupplierDetail.tsx`) and add a `<MilestoneProgress poId={...} poTotal={...} />` section within each PO's expandable detail area. Only render if the PO has milestones (check by fetching or passing a flag).

- [ ] **Step 4: Add milestone actions to SupplierEmulator**

When a PO has milestones, show the list with "Mark Complete" button on the next PENDING milestone.

- [ ] **Step 5: Verify build and commit**

```bash
git add app/src/components/payable/MilestoneProgress.tsx app/src/components/payable/MilestoneTemplates.tsx
git add app/src/app/payable/ app/src/components/emulator/SupplierEmulator.tsx
git commit -m "feat: add milestone progress visualization and template management"
```

---

## Phase 5: Feature 4 — Check Payments

### Task 11: Check payment flow and API

**Files:**
- Create: `app/src/components/pay/CheckPaymentFlow.tsx`
- Create: `app/src/app/api/receivable/payments/[id]/check-action/route.ts`
- Modify: `app/src/app/pay/page.tsx`

- [ ] **Step 1: Create CheckPaymentFlow component**

Two-step flow: Step 1 shows payee details and check number/bank inputs with clearing notice. Step 2 shows deposit slip upload with AI extraction preview. On submit: calls a new check-specific endpoint or enhanced confirm.

- [ ] **Step 2: Create POST /api/receivable/payments/[id]/check-action**

Uses `verifyToken`. Admin route for confirming or bouncing a check. Body: `{ action: 'confirm' | 'bounce' }`. On confirm: runs payment allocation (same as card confirm). On bounce: sets status to BOUNCED.

- [ ] **Step 3: Add check payment option to /pay page**

Add "Check Payment" as a third payment method option. When selected, render `CheckPaymentFlow` component.

- [ ] **Step 4: Verify build and commit**

```bash
git add app/src/components/pay/CheckPaymentFlow.tsx app/src/app/api/receivable/payments/
git add app/src/app/pay/page.tsx
git commit -m "feat: add check payment flow with deposit slip upload"
```

---

### Task 12: Auto-clearance cron logic

**Files:**
- Modify: `app/src/app/api/cron/refresh-insights/route.ts`

- [ ] **Step 1: Add check auto-clearance to the daily cron**

The existing cron at `POST /api/cron/refresh-insights` runs daily at 22:00 UTC. Add a section at the end that auto-confirms PENDING_CLEARANCE checks whose clearance date has passed:

```typescript
// ── Auto-confirm cleared checks ──
const clearedChecks = await db.execute(sql.raw(`
  SELECT payment_id, invoice_id, customer_id, amount
  FROM incoming_payments_col
  WHERE status = 'PENDING_CLEARANCE'
    AND payment_method = 'CHECK'
    AND clearance_date <= CURRENT_DATE
`))
const checkRows = clearedChecks as unknown as { payment_id: number; invoice_id: number; customer_id: number; amount: string }[]

for (const check of checkRows) {
  // Update status to CONFIRMED
  await db.execute(sql.raw(
    `UPDATE incoming_payments_col SET status = 'CONFIRMED', confirmed_at = NOW() WHERE payment_id = ${check.payment_id}`
  ))
  // Run payment allocation for this check (same logic as card confirm)
  // ... load invoices, penalties, run calculateAllocation, write allocations, update balances
}
```

The allocation logic should be extracted from pay/confirm into a shared helper or called inline.

- [ ] **Step 2: Verify build and commit**

```bash
git add app/src/app/api/cron/refresh-insights/route.ts
git commit -m "feat: add auto-clearance for check payments in daily cron"
```

---

### Task 13: Check payment flow and clearance UI

**Files:**
- Create: `app/src/components/receivable/CheckClearanceCard.tsx`
- Modify: Payment history/allocations component to show check-specific fields

- [ ] **Step 1: Create CheckClearanceCard component**

Shows for CHECK payments: check number, deposit date, clearance date, progress bar (days elapsed / 3), "Confirm Early" and "Mark Bounced" buttons.

- [ ] **Step 2: Integrate into payment history views**

In the existing payment list/allocations components, detect `paymentMethod === 'CHECK'` and render the CheckClearanceCard.

- [ ] **Step 3: Verify build and commit**

```bash
git add app/src/components/receivable/CheckClearanceCard.tsx
git commit -m "feat: add check clearance tracking UI to payments view"
```

---

## Phase 6: Final Integration

### Task 14: Build verification and polish

- [ ] **Step 1: Full build check**

Run: `cd /home/josef/projects/mpe-collections-demo/app && npm run build`

- [ ] **Step 2: Lint check**

Run: `cd /home/josef/projects/mpe-collections-demo/app && npm run lint`

Fix any lint issues in new files.

- [ ] **Step 3: Push schema to production database**

Execute all CREATE TABLE and ALTER TABLE statements via the SQL proxy curl pattern documented in CLAUDE.md.

- [ ] **Step 4: Reseed and verify all features end-to-end**

Trigger reseed via settings UI, then verify:
1. Customer detail shows credit balance card and security deposit card
2. Forfeiture queue in Collections shows flagged items
3. PO detail shows milestone progress
4. Supplier emulator can mark milestones complete
5. Payment portal shows check payment option
6. Admin payments view shows check clearance tracking

- [ ] **Step 5: Deploy to Vercel**

```bash
cd /home/josef/projects/mpe-collections-demo/app && vercel --prod --yes
```

- [ ] **Step 6: Final commit for any remaining fixes**

```bash
git add -A
git commit -m "fix: polish and integration fixes for credit, deposits, milestones, checks"
```
