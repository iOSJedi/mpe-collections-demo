# MPE Collections Portal Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Repurpose the JC Trade Promotion Optimization demo into an Ayala Land Collections & Payments Portal with AR/AP management, QR payment flows, OCR document verification, AI validation, 3-way matching, and SAP Fiori-style navigation.

**Architecture:** Fresh domain logic built on existing Next.js + Supabase + Firebase + Gemini infrastructure. Three interfaces: admin dashboard (SAP Fiori sidebar), customer emulator (popover), and public payment page (/pay route). Stripe for card payments, Gemini multimodal for OCR.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript, Drizzle ORM, Supabase PostgreSQL, Firebase Auth + RTDB, Gemini AI, Stripe, Redux Toolkit, Tailwind CSS, Radix UI

**Spec:** `docs/superpowers/specs/2026-03-10-mpe-collections-portal-design.md`

---

## File Structure

### Files to DELETE (old JC Supermarket domain)

```
app/src/db/schema.ts                          → rewrite entirely
app/src/types/index.ts                        → rewrite entirely
app/src/app/page.tsx                          → rewrite (Overview dashboard)
app/src/app/analytics/page.tsx                → rewrite
app/src/app/branches/page.tsx                 → delete
app/src/app/chat/page.tsx                     → rewrite (AI Assistant)
app/src/app/customers/page.tsx                → rewrite (AR Customer Accounts)
app/src/app/customers/[id]/page.tsx           → rewrite (Customer Detail)
app/src/app/wholesale/page.tsx                → delete
app/src/app/api/branches/route.ts             → delete
app/src/app/api/customers/route.ts            → rewrite
app/src/app/api/customers/[id]/route.ts       → rewrite
app/src/app/api/wholesale/route.ts            → delete
app/src/app/api/kpi/route.ts                  → rewrite
app/src/app/api/insights/route.ts             → keep, minor updates
app/src/app/api/chat/route.ts                 → keep, update system prompt
app/src/components/branches/                  → delete directory
app/src/components/wholesale/                 → delete directory
app/src/components/customers/CustomerList.tsx  → rewrite
app/src/components/customers/CustomerDNA.tsx   → rewrite
app/src/components/dashboard/KPICard.tsx       → keep
app/src/components/dashboard/InsightCardComponent.tsx → keep
app/src/components/layout/Sidebar.tsx          → rewrite (SAP Fiori style)
app/src/components/layout/TopBar.tsx           → rewrite (Ayala Land branding)
app/src/components/layout/AppShell.tsx         → modify (add bottom bar)
app/src/store/slices/branchSlice.ts            → delete
app/src/store/slices/wholesaleSlice.ts         → delete
app/src/store/slices/navSlice.ts               → rewrite
app/src/store/slices/customerSlice.ts          → rewrite
app/src/store/slices/dashboardSlice.ts         → rewrite
app/src/store/slices/chatSlice.ts              → keep
app/src/store/slices/analyticsSlice.ts         → rewrite
app/src/store/index.ts                         → rewrite (new slices)
app/src/lib/gemini.ts                          → rewrite (new schema DDL + system prompt)
app/src/lib/utils.ts                           → update formatCurrency
app/scripts/seed.ts                            → rewrite entirely
app/scripts/create-tables.sql                  → rewrite entirely
ml_pipeline/                                   → rewrite Python models
```

### Files to CREATE

```
# New pages
app/src/app/receivable/page.tsx                → AR Customer Accounts list
app/src/app/receivable/[id]/page.tsx           → Customer Detail (contracts, invoices, payments)
app/src/app/receivable/payments/page.tsx       → Incoming Payments log
app/src/app/payable/page.tsx                   → AP Supplier Accounts list
app/src/app/payable/[id]/page.tsx              → Supplier Detail
app/src/app/payable/matching/page.tsx          → GR/IR Reconciliation (3-way match)
app/src/app/collections/page.tsx               → Collections Worklist
app/src/app/collections/documents/page.tsx     → Document Verification
app/src/app/collections/escalations/page.tsx   → Escalation Queue
app/src/app/intelligence/page.tsx              → AI Assistant (chat)
app/src/app/intelligence/insights/page.tsx     → Insights & Scoring
app/src/app/intelligence/analytics/page.tsx    → Analytics dashboards
app/src/app/pay/page.tsx                       → Public payment page (QR target)

# New API routes
app/src/app/api/receivable/route.ts            → List customers
app/src/app/api/receivable/[id]/route.ts       → Customer detail
app/src/app/api/receivable/payments/route.ts   → Incoming payments
app/src/app/api/payable/route.ts               → List suppliers
app/src/app/api/payable/[id]/route.ts          → Supplier detail
app/src/app/api/payable/matching/route.ts      → 3-way matches
app/src/app/api/invoices/route.ts              → Invoice CRUD
app/src/app/api/invoices/[id]/route.ts         → Invoice detail
app/src/app/api/qr/route.ts                    → Generate QR code
app/src/app/api/qr/verify/route.ts             → Verify QR JWT token
app/src/app/api/pay/route.ts                   → Create Stripe PaymentIntent
app/src/app/api/pay/confirm/route.ts           → Confirm payment, update balance
app/src/app/api/documents/route.ts             → Upload proof-of-payment
app/src/app/api/documents/[id]/route.ts        → Document detail + OCR result
app/src/app/api/ocr/route.ts                   → Trigger OCR on document
app/src/app/api/escalations/route.ts           → List/create escalations
app/src/app/api/escalations/[id]/route.ts      → Update escalation (resolve/dismiss)
app/src/app/api/collections/worklist/route.ts  → Collections worklist data

# New components
app/src/components/layout/SidebarNew.tsx        → SAP Fiori sidebar (green/gold)
app/src/components/layout/BottomBar.tsx         → Bottom bar with emulator trigger
app/src/components/emulator/CustomerEmulator.tsx → Popover emulator
app/src/components/emulator/EmulatorInvoices.tsx → Invoice list tab
app/src/components/emulator/EmulatorQR.tsx       → QR display tab
app/src/components/emulator/EmulatorUpload.tsx   → Upload proof tab
app/src/components/emulator/EmulatorHistory.tsx  → Payment history tab
app/src/components/receivable/CustomerList.tsx   → Customer accounts table
app/src/components/receivable/CustomerDetail.tsx → Customer detail view
app/src/components/receivable/IncomingPayments.tsx → Payments log
app/src/components/payable/SupplierList.tsx      → Supplier accounts table
app/src/components/payable/SupplierDetail.tsx    → Supplier detail view
app/src/components/payable/ThreeWayMatch.tsx     → GR/IR reconciliation table
app/src/components/payable/MatchDetail.tsx       → Match detail panel
app/src/components/collections/Worklist.tsx      → Collections worklist
app/src/components/collections/DocumentVerification.tsx → OCR results view
app/src/components/collections/EscalationQueue.tsx     → Escalation table
app/src/components/collections/EscalationReview.tsx    → Review detail panel
app/src/components/pay/PaymentForm.tsx           → Public payment form
app/src/components/pay/StripeCardInput.tsx       → Stripe Elements wrapper
app/src/components/pay/BPITransfer.tsx           → BPI transfer option
app/src/components/dashboard/OverviewKPIs.tsx    → KPI tiles for overview
app/src/components/dashboard/AgingChart.tsx      → Aging analysis chart

# New store slices
app/src/store/slices/receivableSlice.ts         → AR state
app/src/store/slices/payableSlice.ts            → AP state
app/src/store/slices/collectionsSlice.ts        → Collections state
app/src/store/slices/emulatorSlice.ts           → Emulator state

# New lib
app/src/lib/jwt.ts                              → JWT sign/verify for QR tokens
app/src/lib/qr.ts                               → QR code generation
app/src/lib/ocr.ts                              → Gemini multimodal OCR
app/src/lib/stripe.ts                           → Stripe server-side helpers
app/src/lib/validation.ts                       → AI validation logic
```

---

## Chunk 1: Foundation — Schema, Types, Branding, Seed Data

### Task 1.1: Install New Dependencies

**Files:**
- Modify: `app/package.json`

- [ ] **Step 1: Install runtime dependencies**

```bash
cd app && npm install stripe qrcode jsonwebtoken @stripe/stripe-js @stripe/react-stripe-js
```

- [ ] **Step 2: Install dev dependencies**

```bash
cd app && npm install -D @types/qrcode @types/jsonwebtoken
```

- [ ] **Step 3: Commit**

```bash
git add app/package.json app/package-lock.json
git commit -m "feat: add stripe, qrcode, jwt dependencies"
```

### Task 1.2: Rewrite Database Schema

**Files:**
- Rewrite: `app/src/db/schema.ts`

- [ ] **Step 1: Write the new Drizzle schema**

Replace the entire file. Define all tables from the spec:

**AR tables:** `customers`, `contracts`, `invoices`, `payments` (incoming), `qrCodes`, `documents`, `escalations`

**AP tables:** `suppliers`, `purchaseOrders`, `goodsReceipts`, `supplierInvoices`, `outgoingPayments`, `threeWayMatches`

**ML tables:** `payerSegments`, `delinquencyScores`, `creditRiskScores`, `insightCards`, `cashFlowForecasts`, `paymentPatterns`

Key patterns to follow from existing schema:
- Use `serial('id').primaryKey()` for auto-increment PKs
- Use `varchar` with explicit lengths for enums (e.g., `varchar('type', { length: 20 })`)
- Use `decimal('amount', { precision: 12, scale: 2 })` for PHP currency amounts
- Use `references(() => table.column)` for FKs
- Add indexes on FK columns and frequently filtered columns
- Use `jsonb` for OCR results, validation results, discrepancies, bank details
- Use `timestamp('created_at').defaultNow()` for audit columns

```typescript
import {
  pgTable, varchar, text, integer, decimal, boolean, date,
  timestamp, serial, jsonb, index, unique,
} from 'drizzle-orm/pg-core'

// ─── ACCOUNTS RECEIVABLE ──────────────────────────────────────

export const customers = pgTable('customers', {
  customerId: serial('customer_id').primaryKey(),
  accountNumber: varchar('account_number', { length: 20 }).notNull().unique(),
  type: varchar('type', { length: 20 }).notNull(), // TENANT | PROPERTY_MANAGER
  name: varchar('name', { length: 200 }).notNull(),
  contactPerson: varchar('contact_person', { length: 200 }),
  email: varchar('email', { length: 200 }),
  phone: varchar('phone', { length: 20 }),
  businessType: varchar('business_type', { length: 100 }),
  propertyName: varchar('property_name', { length: 200 }),
  unitInfo: varchar('unit_info', { length: 200 }),
  status: varchar('status', { length: 20 }).notNull().default('ACTIVE'),
  createdAt: timestamp('created_at').defaultNow(),
})

export const contracts = pgTable('contracts', {
  contractId: serial('contract_id').primaryKey(),
  customerId: integer('customer_id').notNull().references(() => customers.customerId),
  contractNumber: varchar('contract_number', { length: 30 }).notNull().unique(),
  type: varchar('type', { length: 20 }).notNull(), // LEASE | CONCESSION | SERVICE
  description: text('description'),
  monthlyAmount: decimal('monthly_amount', { precision: 12, scale: 2 }).notNull(),
  startDate: date('start_date').notNull(),
  endDate: date('end_date').notNull(),
  status: varchar('status', { length: 20 }).notNull().default('ACTIVE'),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => [
  index('idx_contracts_customer').on(table.customerId),
])

export const invoices = pgTable('invoices', {
  invoiceId: serial('invoice_id').primaryKey(),
  contractId: integer('contract_id').notNull().references(() => contracts.contractId),
  customerId: integer('customer_id').notNull().references(() => customers.customerId),
  invoiceNumber: varchar('invoice_number', { length: 30 }).notNull().unique(),
  billingPeriodStart: date('billing_period_start').notNull(),
  billingPeriodEnd: date('billing_period_end').notNull(),
  dueDate: date('due_date').notNull(),
  amount: decimal('amount', { precision: 12, scale: 2 }).notNull(),
  balanceRemaining: decimal('balance_remaining', { precision: 12, scale: 2 }).notNull(),
  status: varchar('status', { length: 20 }).notNull().default('PENDING'),
  issuedAt: timestamp('issued_at').defaultNow(),
}, (table) => [
  index('idx_invoices_customer').on(table.customerId),
  index('idx_invoices_contract').on(table.contractId),
  index('idx_invoices_status').on(table.status),
  index('idx_invoices_due_date').on(table.dueDate),
])

export const incomingPayments = pgTable('incoming_payments', {
  paymentId: serial('payment_id').primaryKey(),
  invoiceId: integer('invoice_id').notNull().references(() => invoices.invoiceId),
  customerId: integer('customer_id').notNull().references(() => customers.customerId),
  amount: decimal('amount', { precision: 12, scale: 2 }).notNull(),
  paymentMethod: varchar('payment_method', { length: 20 }).notNull(),
  paymentDate: timestamp('payment_date').defaultNow(),
  stripePaymentIntentId: varchar('stripe_payment_intent_id', { length: 200 }),
  referenceNumber: varchar('reference_number', { length: 100 }),
  status: varchar('status', { length: 20 }).notNull().default('PENDING'),
  confirmedAt: timestamp('confirmed_at'),
}, (table) => [
  index('idx_payments_invoice').on(table.invoiceId),
  index('idx_payments_customer').on(table.customerId),
])

export const qrCodes = pgTable('qr_codes', {
  qrId: serial('qr_id').primaryKey(),
  invoiceId: integer('invoice_id').notNull().references(() => invoices.invoiceId),
  customerId: integer('customer_id').notNull().references(() => customers.customerId),
  contractNumber: varchar('contract_number', { length: 30 }).notNull(),
  accountIdentifier: varchar('account_identifier', { length: 20 }).notNull(),
  amount: decimal('amount', { precision: 12, scale: 2 }).notNull(),
  encodedUrl: text('encoded_url').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  expiresAt: timestamp('expires_at').notNull(),
})

export const documents = pgTable('documents', {
  documentId: serial('document_id').primaryKey(),
  customerId: integer('customer_id').notNull().references(() => customers.customerId),
  invoiceId: integer('invoice_id').references(() => invoices.invoiceId),
  paymentId: integer('payment_id').references(() => incomingPayments.paymentId),
  fileUrl: text('file_url').notNull(),
  fileName: varchar('file_name', { length: 200 }).notNull(),
  fileType: varchar('file_type', { length: 50 }).notNull(),
  ocrResult: jsonb('ocr_result'),
  ocrStatus: varchar('ocr_status', { length: 20 }).notNull().default('PENDING'),
  validationResult: jsonb('validation_result'),
  uploadedAt: timestamp('uploaded_at').defaultNow(),
}, (table) => [
  index('idx_documents_customer').on(table.customerId),
])

export const escalations = pgTable('escalations', {
  escalationId: serial('escalation_id').primaryKey(),
  documentId: integer('document_id').notNull().references(() => documents.documentId),
  customerId: integer('customer_id').notNull().references(() => customers.customerId),
  invoiceId: integer('invoice_id').references(() => invoices.invoiceId),
  type: varchar('type', { length: 30 }).notNull(),
  description: text('description').notNull(),
  aiAnalysis: jsonb('ai_analysis'),
  status: varchar('status', { length: 20 }).notNull().default('OPEN'),
  assignedTo: varchar('assigned_to', { length: 200 }),
  resolutionNotes: text('resolution_notes'),
  createdAt: timestamp('created_at').defaultNow(),
  resolvedAt: timestamp('resolved_at'),
}, (table) => [
  index('idx_escalations_status').on(table.status),
  index('idx_escalations_customer').on(table.customerId),
])

// ─── ACCOUNTS PAYABLE ─────────────────────────────────────────

export const suppliers = pgTable('suppliers', {
  supplierId: serial('supplier_id').primaryKey(),
  name: varchar('name', { length: 200 }).notNull(),
  category: varchar('category', { length: 100 }).notNull(),
  type: varchar('type', { length: 30 }).notNull(),
  contactPerson: varchar('contact_person', { length: 200 }),
  email: varchar('email', { length: 200 }),
  phone: varchar('phone', { length: 20 }),
  taxId: varchar('tax_id', { length: 30 }),
  bankDetails: jsonb('bank_details'),
  status: varchar('status', { length: 20 }).notNull().default('ACTIVE'),
  createdAt: timestamp('created_at').defaultNow(),
})

export const purchaseOrders = pgTable('purchase_orders', {
  poId: serial('po_id').primaryKey(),
  poNumber: varchar('po_number', { length: 30 }).notNull().unique(),
  supplierId: integer('supplier_id').notNull().references(() => suppliers.supplierId),
  projectName: varchar('project_name', { length: 200 }).notNull(),
  description: text('description'),
  totalAmount: decimal('total_amount', { precision: 12, scale: 2 }).notNull(),
  issuedDate: date('issued_date').notNull(),
  expectedDelivery: date('expected_delivery'),
  status: varchar('status', { length: 30 }).notNull().default('OPEN'),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => [
  index('idx_po_supplier').on(table.supplierId),
])

export const goodsReceipts = pgTable('goods_receipts', {
  receiptId: serial('receipt_id').primaryKey(),
  poId: integer('po_id').notNull().references(() => purchaseOrders.poId),
  supplierId: integer('supplier_id').notNull().references(() => suppliers.supplierId),
  receiptNumber: varchar('receipt_number', { length: 30 }).notNull(),
  receivedDate: date('received_date').notNull(),
  receivedBy: varchar('received_by', { length: 200 }),
  description: text('description'),
  quantityReceived: decimal('quantity_received', { precision: 12, scale: 2 }),
  unit: varchar('unit', { length: 20 }),
  amount: decimal('amount', { precision: 12, scale: 2 }).notNull(),
  conditionNotes: text('condition_notes'),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => [
  index('idx_gr_po').on(table.poId),
])

export const supplierInvoices = pgTable('supplier_invoices', {
  supplierInvoiceId: serial('supplier_invoice_id').primaryKey(),
  supplierId: integer('supplier_id').notNull().references(() => suppliers.supplierId),
  poId: integer('po_id').notNull().references(() => purchaseOrders.poId),
  invoiceNumber: varchar('invoice_number', { length: 50 }).notNull(),
  amount: decimal('amount', { precision: 12, scale: 2 }).notNull(),
  submittedDate: date('submitted_date').notNull(),
  dueDate: date('due_date').notNull(),
  paymentStatus: varchar('payment_status', { length: 20 }).notNull().default('UNPAID'),
  amountPaid: decimal('amount_paid', { precision: 12, scale: 2 }).notNull().default('0'),
  paymentDate: date('payment_date'),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => [
  index('idx_si_supplier').on(table.supplierId),
  index('idx_si_po').on(table.poId),
])

export const outgoingPayments = pgTable('outgoing_payments', {
  outgoingPaymentId: serial('outgoing_payment_id').primaryKey(),
  supplierInvoiceId: integer('supplier_invoice_id').notNull().references(() => supplierInvoices.supplierInvoiceId),
  supplierId: integer('supplier_id').notNull().references(() => suppliers.supplierId),
  amount: decimal('amount', { precision: 12, scale: 2 }).notNull(),
  paymentMethod: varchar('payment_method', { length: 20 }).notNull(),
  paymentDate: timestamp('payment_date').defaultNow(),
  referenceNumber: varchar('reference_number', { length: 100 }),
  approvedBy: varchar('approved_by', { length: 200 }),
  status: varchar('status', { length: 20 }).notNull().default('PENDING'),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => [
  index('idx_op_supplier_invoice').on(table.supplierInvoiceId),
])

export const threeWayMatches = pgTable('three_way_matches', {
  matchId: serial('match_id').primaryKey(),
  poId: integer('po_id').notNull().references(() => purchaseOrders.poId),
  receiptId: integer('receipt_id').notNull().references(() => goodsReceipts.receiptId),
  supplierInvoiceId: integer('supplier_invoice_id').notNull().references(() => supplierInvoices.supplierInvoiceId),
  supplierId: integer('supplier_id').notNull().references(() => suppliers.supplierId),
  matchStatus: varchar('match_status', { length: 20 }).notNull().default('PENDING_REVIEW'),
  poAmount: decimal('po_amount', { precision: 12, scale: 2 }).notNull(),
  receiptAmount: decimal('receipt_amount', { precision: 12, scale: 2 }).notNull(),
  invoiceAmount: decimal('invoice_amount', { precision: 12, scale: 2 }).notNull(),
  discrepancies: jsonb('discrepancies'),
  aiNotes: text('ai_notes'),
  reviewedBy: varchar('reviewed_by', { length: 200 }),
  reviewedAt: timestamp('reviewed_at'),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => [
  index('idx_twm_status').on(table.matchStatus),
  index('idx_twm_supplier').on(table.supplierId),
])

// ─── ML OUTPUT TABLES ─────────────────────────────────────────

export const payerSegments = pgTable('payer_segments', {
  segmentId: serial('segment_id').primaryKey(),
  customerId: integer('customer_id').notNull().references(() => customers.customerId).unique(),
  segmentName: varchar('segment_name', { length: 50 }).notNull(),
  regularityScore: decimal('regularity_score', { precision: 5, scale: 2 }).notNull(),
  amountScore: decimal('amount_score', { precision: 5, scale: 2 }).notNull(),
  timelinessScore: decimal('timeliness_score', { precision: 5, scale: 2 }).notNull(),
  clusterId: integer('cluster_id').notNull(),
  scoredAt: timestamp('scored_at').defaultNow(),
})

export const delinquencyScores = pgTable('delinquency_scores', {
  delinquencyId: serial('delinquency_id').primaryKey(),
  customerId: integer('customer_id').notNull().references(() => customers.customerId).unique(),
  riskScore: decimal('risk_score', { precision: 5, scale: 4 }).notNull(),
  riskLevel: varchar('risk_level', { length: 10 }).notNull(),
  daysOverdueAvg: decimal('days_overdue_avg', { precision: 6, scale: 1 }),
  missedPayments: integer('missed_payments').default(0),
  paymentTrend: varchar('payment_trend', { length: 20 }),
  topRiskFactor: varchar('top_risk_factor', { length: 100 }),
  scoredAt: timestamp('scored_at').defaultNow(),
}, (table) => [
  index('idx_delinquency_risk').on(table.riskLevel),
])

export const creditRiskScores = pgTable('credit_risk_scores', {
  creditRiskId: serial('credit_risk_id').primaryKey(),
  customerId: integer('customer_id').notNull().references(() => customers.customerId).unique(),
  riskScore: decimal('risk_score', { precision: 5, scale: 4 }).notNull(),
  riskLevel: varchar('risk_level', { length: 10 }).notNull(),
  outstandingBalance: decimal('outstanding_balance', { precision: 12, scale: 2 }),
  creditUtilization: decimal('credit_utilization', { precision: 5, scale: 2 }),
  avgDaysOverdue: decimal('avg_days_overdue', { precision: 6, scale: 1 }),
  paymentTrend: varchar('payment_trend', { length: 20 }),
  scoredAt: timestamp('scored_at').defaultNow(),
}, (table) => [
  index('idx_credit_risk_level').on(table.riskLevel),
])

export const insightCards = pgTable('insight_cards', {
  id: serial('id').primaryKey(),
  severity: varchar('severity', { length: 15 }).notNull(),
  title: varchar('title', { length: 200 }).notNull(),
  body: text('body').notNull(),
  action: text('action'),
  relatedEntityType: varchar('related_entity_type', { length: 20 }),
  relatedEntityId: integer('related_entity_id'),
  relatedParams: jsonb('related_params'),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  expiresAt: timestamp('expires_at'),
}, (table) => [
  index('idx_insight_cards_active').on(table.isActive, table.createdAt),
])

export const cashFlowForecasts = pgTable('cash_flow_forecasts', {
  forecastId: serial('forecast_id').primaryKey(),
  forecastDate: date('forecast_date').notNull(),
  predictedInflow: decimal('predicted_inflow', { precision: 14, scale: 2 }).notNull(),
  predictedOutflow: decimal('predicted_outflow', { precision: 14, scale: 2 }).notNull(),
  confidenceLower: decimal('confidence_lower', { precision: 14, scale: 2 }),
  confidenceUpper: decimal('confidence_upper', { precision: 14, scale: 2 }),
  basedOnPeriod: varchar('based_on_period', { length: 50 }),
  createdAt: timestamp('created_at').defaultNow(),
})

export const paymentPatterns = pgTable('payment_patterns', {
  patternId: serial('pattern_id').primaryKey(),
  customerId: integer('customer_id').notNull().references(() => customers.customerId).unique(),
  avgDaysToPay: decimal('avg_days_to_pay', { precision: 6, scale: 1 }),
  preferredMethod: varchar('preferred_method', { length: 20 }),
  typicalPaymentDay: integer('typical_payment_day'),
  partialPaymentRate: decimal('partial_payment_rate', { precision: 5, scale: 2 }),
  scoredAt: timestamp('scored_at').defaultNow(),
})
```

- [ ] **Step 2: Generate SQL migration from Drizzle schema**

```bash
cd app && npx drizzle-kit generate
```

Review the generated migration SQL file in `drizzle/` directory. Verify all tables, columns, indexes, and constraints match the spec.

- [ ] **Step 3: Commit**

```bash
git add app/src/db/schema.ts app/drizzle/
git commit -m "feat: rewrite database schema for collections domain"
```

### Task 1.3: Rewrite TypeScript Types

**Files:**
- Rewrite: `app/src/types/index.ts`

- [ ] **Step 1: Write all TypeScript interfaces**

```typescript
// Navigation
export type NavSpace = 'overview' | 'receivable' | 'payable' | 'collections' | 'intelligence'
export type NavPage =
  | 'overview'
  | 'customer-accounts' | 'incoming-payments'
  | 'supplier-accounts' | 'gr-ir-reconciliation'
  | 'collections-worklist' | 'document-verification' | 'escalation-queue'
  | 'ai-assistant' | 'insights-scoring' | 'analytics'

// Chat (kept from original)
export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  chartConfig?: ChartConfig | null
  followUpSuggestions?: string[]
  timestamp: number
}

export interface ChartConfig {
  type: 'bar' | 'line' | 'pie' | 'area' | 'composed'
  title: string
  data: Record<string, unknown>[]
  xKey: string
  yKeys: { key: string; color: string; name: string }[]
  interpretation?: string
}

// Insight Cards (kept from original, updated fields)
export interface InsightCard {
  id: number
  severity: 'info' | 'warning' | 'critical'
  title: string
  body: string
  action: string | null
  related_entity_type: string | null
  related_entity_id: number | null
  related_params: Record<string, unknown> | null
  created_at: string
}

// AR Types
export interface CustomerSummary {
  customer_id: number
  account_number: string
  type: 'TENANT' | 'PROPERTY_MANAGER'
  name: string
  business_type: string | null
  property_name: string | null
  unit_info: string | null
  status: string
  total_receivable: number
  overdue_amount: number
  delinquency_risk: string | null
  segment_name: string | null
}

export interface CustomerDetail extends CustomerSummary {
  contact_person: string | null
  email: string | null
  phone: string | null
  contracts: ContractSummary[]
  invoices: InvoiceSummary[]
  recent_payments: PaymentSummary[]
  delinquency_score: number | null
  credit_risk_level: string | null
  payment_pattern: PaymentPatternData | null
}

export interface ContractSummary {
  contract_id: number
  contract_number: string
  type: string
  description: string | null
  monthly_amount: number
  start_date: string
  end_date: string
  status: string
}

export interface InvoiceSummary {
  invoice_id: number
  invoice_number: string
  contract_number: string
  billing_period_start: string
  billing_period_end: string
  due_date: string
  amount: number
  balance_remaining: number
  status: string
}

export interface PaymentSummary {
  payment_id: number
  invoice_number: string
  amount: number
  payment_method: string
  payment_date: string
  reference_number: string | null
  status: string
}

export interface PaymentPatternData {
  avg_days_to_pay: number | null
  preferred_method: string | null
  typical_payment_day: number | null
  partial_payment_rate: number | null
}

// AP Types
export interface SupplierSummary {
  supplier_id: number
  name: string
  category: string
  type: string
  status: string
  total_payable: number
  open_pos: number
  blocked_invoices: number
}

export interface SupplierDetail extends SupplierSummary {
  contact_person: string | null
  email: string | null
  phone: string | null
  tax_id: string | null
  purchase_orders: POSummary[]
  recent_invoices: SupplierInvoiceSummary[]
}

export interface POSummary {
  po_id: number
  po_number: string
  project_name: string
  total_amount: number
  issued_date: string
  status: string
}

export interface SupplierInvoiceSummary {
  supplier_invoice_id: number
  invoice_number: string
  po_number: string
  amount: number
  submitted_date: string
  due_date: string
  payment_status: string
}

export interface ThreeWayMatchRow {
  match_id: number
  po_number: string
  supplier_name: string
  project_name: string
  po_amount: number
  receipt_amount: number
  invoice_amount: number
  match_status: string
  payment_status: string
  discrepancies: { field: string; expected: string; actual: string; severity: string }[] | null
  ai_notes: string | null
}

// Collections Types
export interface WorklistItem {
  customer_id: number
  account_number: string
  name: string
  type: string
  total_overdue: number
  oldest_invoice_date: string
  risk_level: string | null
  last_payment_date: string | null
  days_overdue: number
}

export interface DocumentRecord {
  document_id: number
  customer_name: string
  invoice_number: string | null
  file_name: string
  file_type: string
  ocr_status: string
  ocr_result: OcrResult | null
  validation_result: ValidationResult | null
  uploaded_at: string
}

export interface OcrResult {
  payment_amount: number | null
  payment_date: string | null
  reference_number: string | null
  bank_name: string | null
  payee_name: string | null
  payer_name: string | null
  document_type: string | null
}

export interface ValidationResult {
  is_valid: boolean
  checks: ValidationCheck[]
}

export interface ValidationCheck {
  check: string
  passed: boolean
  expected: string | null
  actual: string | null
  severity: 'info' | 'warning' | 'critical'
}

export interface EscalationRecord {
  escalation_id: number
  document_id: number
  customer_name: string
  invoice_number: string | null
  type: string
  description: string
  ai_analysis: Record<string, unknown> | null
  status: string
  assigned_to: string | null
  created_at: string
  resolved_at: string | null
}

// QR / Payment types
export interface QrPayload {
  inv: string   // invoice_number
  con: string   // contract_number
  acct: string  // account_number
  amt: number   // invoice amount
  bal: number   // balance remaining
  due: string   // due date
  exp: number   // expiry timestamp
}

export interface PaymentPageData {
  invoice_number: string
  contract_number: string
  account_number: string
  customer_name: string
  due_date: string
  amount: number
  balance_remaining: number
}

// KPI types
export interface OverviewKPIs {
  total_receivables: number
  overdue_receivables: number
  dso: number
  blocked_invoices: number
  total_customers: number
  overdue_customers: number
  collection_rate: number
  total_payables: number
}

// Emulator
export interface EmulatorState {
  isOpen: boolean
  selectedCustomerId: number | null
  activeTab: 'invoices' | 'qr' | 'upload' | 'history'
  selectedInvoiceId: number | null
}
```

- [ ] **Step 2: Commit**

```bash
git add app/src/types/index.ts
git commit -m "feat: rewrite TypeScript types for collections domain"
```

### Task 1.4: Update Branding & Tailwind Theme

**Files:**
- Modify: `app/src/app/globals.css`
- Modify: `app/src/app/layout.tsx`
- Modify: `app/src/lib/utils.ts`

- [ ] **Step 1: Update CSS variables in globals.css**

Find the `:root` CSS variable block and update colors to Ayala Land green/gold palette:

```css
:root {
  --background: 0 0% 98%;
  --foreground: 150 30% 8%;
  --card: 0 0% 100%;
  --card-foreground: 150 30% 8%;
  --popover: 0 0% 100%;
  --popover-foreground: 150 30% 8%;
  --primary: 153 100% 11%;       /* #003B1F - Ayala dark green */
  --primary-foreground: 46 75% 55%; /* #C5A930 - Ayala gold */
  --secondary: 46 75% 55%;       /* Gold */
  --secondary-foreground: 153 100% 11%;
  --muted: 150 10% 95%;
  --muted-foreground: 150 10% 40%;
  --accent: 153 40% 92%;
  --accent-foreground: 153 100% 11%;
  --destructive: 0 84% 60%;
  --destructive-foreground: 0 0% 98%;
  --border: 150 10% 90%;
  --input: 150 10% 90%;
  --ring: 153 100% 11%;
  --radius: 0.5rem;
  --warning: 38 92% 50%;
  --success: 142 71% 45%;
  --info: 217 91% 60%;
  --chart-1: 153 100% 11%;
  --chart-2: 46 75% 55%;
  --chart-3: 142 71% 45%;
  --chart-4: 38 92% 50%;
  --chart-5: 0 84% 60%;
}
```

- [ ] **Step 2: Update layout.tsx metadata**

```typescript
export const metadata: Metadata = {
  title: 'Ayala Land Collections Portal',
  description: 'Collections & Payments Management System',
}
```

- [ ] **Step 3: Update formatCurrency in utils.ts**

Ensure the `formatCurrency` function formats in Philippine Peso (₱). The existing one already does this — verify it uses `'en-PH'` locale and `'PHP'` currency.

- [ ] **Step 4: Commit**

```bash
git add app/src/app/globals.css app/src/app/layout.tsx app/src/lib/utils.ts
git commit -m "feat: apply Ayala Land branding and color theme"
```

### Task 1.5: Write Seed Script

**Files:**
- Rewrite: `app/scripts/seed.ts`
- Rewrite: `app/scripts/create-tables.sql`

- [ ] **Step 1: Write the seed script**

The seed script must:
1. Connect to the Supabase database via the SQL proxy
2. Create all tables (run the Drizzle migration SQL or the create-tables.sql)
3. Insert 30 tenant customers at real Ayala Land properties
4. Insert 20 property manager customers
5. Insert 1-2 contracts per customer
6. Insert 3-6 months of invoices per contract (Oct 2025 – Mar 2026), with realistic statuses
7. Insert payment records for paid/partial invoices
8. Insert 20 suppliers (the specific list from the spec)
9. Insert 2-3 purchase orders per supplier, linked to real Ayala Land projects
10. Insert goods receipts for received POs
11. Insert supplier invoices
12. Insert outgoing payments for paid supplier invoices
13. Compute and insert 3-way matches (mix of FULL_MATCH, PARTIAL_MATCH, MISMATCH)
14. Insert ML scores (payer_segments, delinquency_scores, credit_risk_scores, payment_patterns)
15. Insert 3-5 insight cards
16. Insert 2-3 sample documents with OCR results
17. Insert 2-3 escalations in various states

Tenant seed data should use real businesses at Ayala properties:
- Greenbelt: Uniqlo, Zara, H&M, Apple Store, etc.
- Glorietta: Jollibee, McDonald's, BPI, Mercury Drug, etc.
- Ayala Triangle: JP Morgan, Accenture, Deloitte, etc.
- One Ayala: Samsung, Globe, Smart, etc.

Property manager seed data:
- DMCI Homes Property Management
- Megaworld Property Management
- Federal Land Property Management
- etc.

Use `tsx` to run: `cd app && npx tsx scripts/seed.ts`

- [ ] **Step 2: Commit**

```bash
git add app/scripts/seed.ts app/scripts/create-tables.sql
git commit -m "feat: add seed script with 50 customers, 20 suppliers, transactional data"
```

---

## Chunk 2: App Shell, Navigation & Overview Dashboard

### Task 2.1: Rewrite Redux Store

**Files:**
- Rewrite: `app/src/store/index.ts`
- Rewrite: `app/src/store/slices/navSlice.ts`
- Rewrite: `app/src/store/slices/dashboardSlice.ts`
- Create: `app/src/store/slices/receivableSlice.ts`
- Create: `app/src/store/slices/payableSlice.ts`
- Create: `app/src/store/slices/collectionsSlice.ts`
- Create: `app/src/store/slices/emulatorSlice.ts`
- Delete: `app/src/store/slices/branchSlice.ts`
- Delete: `app/src/store/slices/wholesaleSlice.ts`

- [ ] **Step 1: Rewrite navSlice**

```typescript
import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import { NavSpace, NavPage } from '@/types'

interface NavState {
  activeSpace: NavSpace
  activePage: NavPage
}

const initialState: NavState = {
  activeSpace: 'overview',
  activePage: 'overview',
}

const navSlice = createSlice({
  name: 'nav',
  initialState,
  reducers: {
    setActiveSpace(state, action: PayloadAction<NavSpace>) {
      state.activeSpace = action.payload
    },
    setActivePage(state, action: PayloadAction<NavPage>) {
      state.activePage = action.payload
    },
    navigate(state, action: PayloadAction<{ space: NavSpace; page: NavPage }>) {
      state.activeSpace = action.payload.space
      state.activePage = action.payload.page
    },
  },
})

export const { setActiveSpace, setActivePage, navigate } = navSlice.actions
export default navSlice.reducer
```

- [ ] **Step 2: Create emulatorSlice**

```typescript
import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import { EmulatorState } from '@/types'

const initialState: EmulatorState = {
  isOpen: false,
  selectedCustomerId: null,
  activeTab: 'invoices',
  selectedInvoiceId: null,
}

const emulatorSlice = createSlice({
  name: 'emulator',
  initialState,
  reducers: {
    toggleEmulator(state) { state.isOpen = !state.isOpen },
    openEmulator(state) { state.isOpen = true },
    closeEmulator(state) { state.isOpen = false },
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
  },
})

export const { toggleEmulator, openEmulator, closeEmulator, setSelectedCustomer, setActiveTab, setSelectedInvoice } = emulatorSlice.actions
export default emulatorSlice.reducer
```

- [ ] **Step 3: Create receivableSlice, payableSlice, collectionsSlice, rewrite dashboardSlice**

Follow the same pattern as existing slices. Each holds list data, detail data, loading/error state, and filters. Use `createAsyncThunk` for API calls to `/api/receivable`, `/api/payable`, `/api/collections/worklist`, etc.

- [ ] **Step 4: Update store/index.ts**

```typescript
import { configureStore } from '@reduxjs/toolkit'
import { TypedUseSelectorHook, useDispatch, useSelector } from 'react-redux'
import navReducer from './slices/navSlice'
import chatReducer from './slices/chatSlice'
import dashboardReducer from './slices/dashboardSlice'
import receivableReducer from './slices/receivableSlice'
import payableReducer from './slices/payableSlice'
import collectionsReducer from './slices/collectionsSlice'
import emulatorReducer from './slices/emulatorSlice'

export const store = configureStore({
  reducer: {
    nav: navReducer,
    chat: chatReducer,
    dashboard: dashboardReducer,
    receivable: receivableReducer,
    payable: payableReducer,
    collections: collectionsReducer,
    emulator: emulatorReducer,
  },
})

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
export const useAppDispatch: () => AppDispatch = useDispatch
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector
```

- [ ] **Step 5: Delete old slices**

```bash
rm app/src/store/slices/branchSlice.ts app/src/store/slices/wholesaleSlice.ts app/src/store/slices/customerSlice.ts
```

- [ ] **Step 6: Commit**

```bash
git add app/src/store/
git commit -m "feat: rewrite Redux store with collections domain slices"
```

### Task 2.2: Rewrite Layout Components

**Files:**
- Rewrite: `app/src/components/layout/Sidebar.tsx`
- Create: `app/src/components/layout/BottomBar.tsx`
- Modify: `app/src/components/layout/AppShell.tsx`
- Rewrite: `app/src/components/layout/TopBar.tsx`

- [ ] **Step 1: Rewrite Sidebar with SAP Fiori navigation**

Dark green background (`#003B1F`), gold accent (`#C5A930`). Navigation items:
- Overview (LayoutDashboard icon)
- Accounts Receivable (ArrowDownToLine icon) — with sub-pages
- Accounts Payable (ArrowUpFromLine icon) — with sub-pages
- Collections Mgmt (ClipboardList icon) — with sub-pages
- Intelligence (Brain icon) — with sub-pages

Each space expands to show its pages. Active state uses gold left-border. Use `useRouter` + Redux `navigate` action for routing.

- [ ] **Step 2: Create BottomBar**

Shows logged-in user info on the left, gold "Customer Emulator" button on the right that dispatches `toggleEmulator()`.

- [ ] **Step 3: Update AppShell**

Add `BottomBar` below the main content area. Structure:
```
TopBar
├── Sidebar | Main Content
BottomBar
```

- [ ] **Step 4: Rewrite TopBar**

Replace "Data Intelligence System" with "AYALA LAND" in gold, "Collections & Payments Portal" subtitle. Keep Firebase auth user display.

- [ ] **Step 5: Commit**

```bash
git add app/src/components/layout/
git commit -m "feat: SAP Fiori sidebar, bottom bar, Ayala Land branding"
```

### Task 2.3: Delete Old Pages & Components

**Files:**
- Delete old domain pages and components

- [ ] **Step 1: Remove old files**

```bash
rm -rf app/src/app/branches app/src/app/wholesale app/src/app/customers
rm -rf app/src/components/branches app/src/components/wholesale app/src/components/customers
rm app/src/app/api/branches/route.ts app/src/app/api/wholesale/route.ts
rm -rf app/src/app/api/customers
```

- [ ] **Step 2: Commit**

```bash
git add -A
git commit -m "chore: remove old JC Supermarket pages and components"
```

### Task 2.4: Overview Dashboard & KPI API

**Files:**
- Rewrite: `app/src/app/page.tsx`
- Rewrite: `app/src/app/api/kpi/route.ts`
- Create: `app/src/components/dashboard/OverviewKPIs.tsx`
- Create: `app/src/components/dashboard/AgingChart.tsx`

- [ ] **Step 1: Rewrite KPI API route**

Query totals from `invoices`, `incoming_payments`, `three_way_matches` tables:
- Total Receivables: `SUM(balance_remaining)` from invoices where status != 'PAID'
- Overdue Receivables: same but where `due_date < NOW()` and status != 'PAID'
- DSO: `AVG(payment_date - issued_at)` from paid invoices
- Blocked Invoices: `COUNT(*)` from `three_way_matches` where `match_status = 'MISMATCH'`
- Collection Rate: paid invoices / total invoices ratio
- Total Payables: `SUM(amount - amount_paid)` from `supplier_invoices` where `payment_status != 'PAID'`

- [ ] **Step 2: Create OverviewKPIs component**

4 KPI cards in a grid. Reuse existing `KPICard` component pattern. Colors: green for receivables, amber for overdue, blue for DSO, red for blocked.

- [ ] **Step 3: Create AgingChart**

Recharts bar chart showing aging buckets: Current, 1-30 days, 31-60 days, 61-90 days, 90+ days. Query from invoices grouped by days overdue.

- [ ] **Step 4: Rewrite Overview page**

Compose: OverviewKPIs + AgingChart + InsightCards. Fetch data via dashboardSlice thunks.

- [ ] **Step 5: Commit**

```bash
git add app/src/app/page.tsx app/src/app/api/kpi/ app/src/components/dashboard/
git commit -m "feat: overview dashboard with AR/AP KPIs and aging chart"
```

---

## Chunk 3: Accounts Receivable Pages

### Task 3.1: Customer List API & Page

**Files:**
- Create: `app/src/app/api/receivable/route.ts`
- Create: `app/src/app/receivable/page.tsx`
- Create: `app/src/components/receivable/CustomerList.tsx`

- [ ] **Step 1: Write Customer List API**

`GET /api/receivable` — Returns customer list with aggregated receivable data. Joins `customers` with `invoices` (SUM balance_remaining, overdue amount), `delinquency_scores` (risk_level), `payer_segments` (segment_name). Supports query params: `type` filter, `search`, `status`, pagination.

- [ ] **Step 2: Write CustomerList component**

Table with columns: Account #, Name, Type (badge), Property, Total Receivable, Overdue, Risk Level (color-coded badge), Status. Click row → navigate to customer detail. Filters bar at top for type, status, search.

- [ ] **Step 3: Write receivable page**

Simple page wrapper rendering `<CustomerList />`.

- [ ] **Step 4: Commit**

```bash
git add app/src/app/receivable/ app/src/app/api/receivable/ app/src/components/receivable/
git commit -m "feat: customer accounts list page with filtering"
```

### Task 3.2: Customer Detail API & Page

**Files:**
- Create: `app/src/app/api/receivable/[id]/route.ts`
- Create: `app/src/app/receivable/[id]/page.tsx`
- Create: `app/src/components/receivable/CustomerDetail.tsx`

- [ ] **Step 1: Write Customer Detail API**

`GET /api/receivable/[id]` — Returns full `CustomerDetail` type. Queries: customer record, their contracts, invoices (last 6 months), recent payments (last 20), delinquency score, credit risk, payment pattern.

- [ ] **Step 2: Write CustomerDetail component**

Layout: Customer header (name, account#, type, status, property) → Contracts section (collapsible list) → Invoices table (with status badges, amounts) → Payment History table → Risk sidebar (delinquency score, credit risk, payment pattern).

- [ ] **Step 3: Commit**

```bash
git add app/src/app/receivable/ app/src/app/api/receivable/ app/src/components/receivable/
git commit -m "feat: customer detail page with contracts, invoices, payments"
```

### Task 3.3: Incoming Payments API & Page

**Files:**
- Create: `app/src/app/api/receivable/payments/route.ts`
- Create: `app/src/app/receivable/payments/page.tsx`
- Create: `app/src/components/receivable/IncomingPayments.tsx`

- [ ] **Step 1: Write Incoming Payments API**

`GET /api/receivable/payments` — Returns payment records joined with customer name and invoice number. Filter by: payment_method, status, date range, search. Sorted by payment_date DESC.

- [ ] **Step 2: Write IncomingPayments component**

Table: Date, Customer, Invoice #, Amount (formatted PHP), Method (badge), Reference #, Status (badge). Filters bar for method, status, date range.

- [ ] **Step 3: Commit**

```bash
git add app/src/app/receivable/payments/ app/src/app/api/receivable/payments/ app/src/components/receivable/
git commit -m "feat: incoming payments log page"
```

---

## Chunk 4: QR Code Generation & Payment Page

### Task 4.1: JWT & QR Code Libraries

**Files:**
- Create: `app/src/lib/jwt.ts`
- Create: `app/src/lib/qr.ts`
- Create: `app/src/lib/stripe.ts`

- [ ] **Step 1: Write JWT helper**

```typescript
import jwt from 'jsonwebtoken'
import { QrPayload } from '@/types'

const SECRET = process.env.QR_JWT_SECRET || 'demo-secret-change-in-production'

export function signQrToken(payload: QrPayload): string {
  return jwt.sign(payload, SECRET, { expiresIn: '24h' })
}

export function verifyQrToken(token: string): QrPayload {
  return jwt.verify(token, SECRET) as QrPayload
}
```

- [ ] **Step 2: Write QR generation helper**

```typescript
import QRCode from 'qrcode'

export async function generateQrDataUrl(url: string): Promise<string> {
  return QRCode.toDataURL(url, {
    width: 300,
    margin: 2,
    color: { dark: '#003B1F', light: '#FFFFFF' },
  })
}

export async function generateQrSvg(url: string): Promise<string> {
  return QRCode.toString(url, { type: 'svg', width: 300, margin: 2 })
}
```

- [ ] **Step 3: Write Stripe helper**

```typescript
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-11-20.acacia' as Stripe.LatestApiVersion,
})

export async function createPaymentIntent(amountInCentavos: number, metadata: Record<string, string>) {
  return stripe.paymentIntents.create({
    amount: amountInCentavos,
    currency: 'php',
    metadata,
  })
}

export { stripe }
```

- [ ] **Step 4: Commit**

```bash
git add app/src/lib/jwt.ts app/src/lib/qr.ts app/src/lib/stripe.ts
git commit -m "feat: add JWT, QR code, and Stripe helper libraries"
```

### Task 4.2: QR Code API

**Files:**
- Create: `app/src/app/api/qr/route.ts`
- Create: `app/src/app/api/qr/verify/route.ts`

- [ ] **Step 1: Write QR generation API**

`POST /api/qr` — Accepts `{ invoiceId }`. Looks up invoice + contract + customer. Creates JWT token with QR payload. Generates QR data URL. Saves to `qr_codes` table. Returns `{ qrDataUrl, encodedUrl, expiresAt }`.

- [ ] **Step 2: Write QR verify API**

`POST /api/qr/verify` — Accepts `{ token }`. Verifies JWT. Looks up invoice from DB to get current balance (not just JWT amount). Returns `PaymentPageData`.

- [ ] **Step 3: Commit**

```bash
git add app/src/app/api/qr/
git commit -m "feat: QR code generation and verification API"
```

### Task 4.3: Payment Page & Stripe Integration

**Files:**
- Create: `app/src/app/pay/page.tsx`
- Create: `app/src/components/pay/PaymentForm.tsx`
- Create: `app/src/components/pay/StripeCardInput.tsx`
- Create: `app/src/components/pay/BPITransfer.tsx`
- Create: `app/src/app/api/pay/route.ts`
- Create: `app/src/app/api/pay/confirm/route.ts`

- [ ] **Step 1: Write PaymentIntent API**

`POST /api/pay` — Accepts `{ token, amount }`. Verifies JWT, re-validates amount against DB balance (amount must be ≤ balance_remaining), creates Stripe PaymentIntent, returns `{ clientSecret, paymentIntentId }`.

- [ ] **Step 2: Write payment confirm API**

`POST /api/pay/confirm` — Accepts `{ paymentIntentId, invoiceId, amount }`. Verifies the PaymentIntent succeeded with Stripe. Creates incoming payment record. Updates invoice `balance_remaining` (decrement by amount). Updates invoice status to PAID (if balance = 0) or PARTIAL. Invalidates the QR code used. Returns success.

- [ ] **Step 3: Write StripeCardInput component**

Client component wrapping Stripe Elements `<CardElement>` with custom Ayala Land styling. Use Stripe's `appearance` API to hide Stripe branding:

```typescript
const appearance: Appearance = {
  theme: 'flat',
  variables: {
    colorPrimary: '#003B1F',
    colorBackground: '#ffffff',
    fontFamily: 'Inter, system-ui, sans-serif',
  },
  rules: {
    '.Label': { color: '#64748b' },
  },
}
```

- [ ] **Step 4: Write BPITransfer component**

Shows static BPI account details (account name, account number, bank branch). Instructions to transfer and upload receipt. Includes a file upload input that posts to `/api/documents`.

- [ ] **Step 5: Write PaymentForm component**

Parent component handling:
- Full/Partial toggle (radio buttons)
- Editable amount field (for partial)
- Payment method selector (Card vs BPI)
- Conditionally renders StripeCardInput or BPITransfer
- "PAY" button that: creates PaymentIntent → confirms with Stripe → calls /api/pay/confirm → shows success

- [ ] **Step 6: Write /pay page**

Server component that reads `token` from searchParams, calls `verifyQrToken` on the server, renders `<PaymentForm>` with the decoded data. Mobile-first layout with Ayala Land header. Wraps content in Stripe `<Elements>` provider. This page has NO AppShell — it's a standalone public page.

- [ ] **Step 7: Commit**

```bash
git add app/src/app/pay/ app/src/app/api/pay/ app/src/components/pay/
git commit -m "feat: public payment page with Stripe and BPI transfer"
```

---

## Chunk 5: Customer Emulator

### Task 5.1: Customer Emulator Popover

**Files:**
- Create: `app/src/components/emulator/CustomerEmulator.tsx`
- Create: `app/src/components/emulator/EmulatorInvoices.tsx`
- Create: `app/src/components/emulator/EmulatorQR.tsx`
- Create: `app/src/components/emulator/EmulatorUpload.tsx`
- Create: `app/src/components/emulator/EmulatorHistory.tsx`
- Create: `app/src/app/api/invoices/route.ts`
- Modify: `app/src/components/layout/AppShell.tsx` (render emulator)

- [ ] **Step 1: Write Invoice API for emulator**

`GET /api/invoices?customerId=N` — Returns invoices for a specific customer with status and balance info. Used by the emulator to show "My Invoices."

- [ ] **Step 2: Write CustomerEmulator**

Root popover component. Uses Radix `<Popover>` or custom positioned div. Renders:
- Header: "Customer Emulator" title + close button
- Customer selector dropdown (fetches from `/api/receivable`)
- Type/status badges for selected customer
- Tab bar: Invoices | QR | Upload | History
- Active tab content

Controlled by `emulatorSlice` state.

- [ ] **Step 3: Write EmulatorInvoices**

Fetches invoices for `selectedCustomerId`. Renders invoice cards with status badge, amount, due date, and action buttons ("Show QR", "Upload Proof"). "Show QR" sets `selectedInvoiceId` and switches to QR tab.

- [ ] **Step 4: Write EmulatorQR**

For `selectedInvoiceId`, calls `POST /api/qr` to generate QR. Displays:
- Invoice number + amount
- QR code image (rendered from data URL)
- Contract/account details below QR
- "Scan with your phone camera" instruction

- [ ] **Step 5: Write EmulatorUpload**

File upload form. Accepts image/PDF. Submits to `POST /api/documents` with `customerId` and optionally `invoiceId`. Shows upload progress and OCR result when complete.

- [ ] **Step 6: Write EmulatorHistory**

Fetches payments for `selectedCustomerId` from `/api/receivable/payments?customerId=N`. Simple table: date, invoice, amount, method, status.

- [ ] **Step 7: Add CustomerEmulator to AppShell**

Render `<CustomerEmulator />` inside AppShell, positioned above the BottomBar. Only visible when `emulatorSlice.isOpen` is true.

- [ ] **Step 8: Commit**

```bash
git add app/src/components/emulator/ app/src/app/api/invoices/ app/src/components/layout/AppShell.tsx
git commit -m "feat: customer emulator popover with invoices, QR, upload, history"
```

---

## Chunk 6: OCR, Document Verification & Escalation

### Task 6.1: OCR & Validation Pipeline

**Files:**
- Create: `app/src/lib/ocr.ts`
- Create: `app/src/lib/validation.ts`
- Create: `app/src/app/api/documents/route.ts`
- Create: `app/src/app/api/documents/[id]/route.ts`
- Create: `app/src/app/api/ocr/route.ts`

- [ ] **Step 1: Write OCR helper**

Uses Gemini multimodal to extract payment details from an image:

```typescript
import { GoogleGenerativeAI } from '@google/generative-ai'
import { OcrResult } from '@/types'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

export async function extractPaymentDetails(imageBase64: string, mimeType: string): Promise<OcrResult> {
  const model = genAI.getGenerativeModel({ model: 'gemini-3.1-pro-preview' })
  const result = await model.generateContent([
    {
      inlineData: { mimeType, data: imageBase64 },
    },
    {
      text: `Analyze this payment proof document. Extract the following fields and return as JSON only:
{
  "payment_amount": <number or null>,
  "payment_date": "<ISO date string or null>",
  "reference_number": "<string or null>",
  "bank_name": "<string or null>",
  "payee_name": "<string or null - who received the payment>",
  "payer_name": "<string or null - who made the payment>",
  "document_type": "<check | bank_transfer | deposit_slip | other>"
}
Return ONLY the JSON object, no other text.`,
    },
  ])

  const text = result.response.text()
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('Failed to extract OCR data')
  return JSON.parse(jsonMatch[0]) as OcrResult
}
```

- [ ] **Step 2: Write validation helper**

```typescript
import { OcrResult, ValidationResult, ValidationCheck } from '@/types'

interface InvoiceContext {
  invoiceNumber: string
  amount: number
  balanceRemaining: number
  dueDate: string
  customerName: string
  issuedAt: string
}

export function validateDocument(
  ocr: OcrResult,
  context: InvoiceContext,
  uploadingCustomerName: string,
  existingReferenceNumbers: string[]
): ValidationResult {
  const checks: ValidationCheck[] = []

  // PAYER_MISMATCH: payer name on receipt vs customer who uploaded
  if (ocr.payer_name) {
    const nameMatch = fuzzyMatch(ocr.payer_name, uploadingCustomerName)
    checks.push({
      check: 'PAYER_MISMATCH',
      passed: nameMatch,
      expected: uploadingCustomerName,
      actual: ocr.payer_name,
      severity: nameMatch ? 'info' : 'critical',
    })
  }

  // AMOUNT_MISMATCH
  if (ocr.payment_amount !== null) {
    const amountMatch = Math.abs(ocr.payment_amount - context.balanceRemaining) < 0.01
        || ocr.payment_amount <= context.balanceRemaining
    checks.push({
      check: 'AMOUNT_MISMATCH',
      passed: amountMatch,
      expected: String(context.balanceRemaining),
      actual: String(ocr.payment_amount),
      severity: amountMatch ? 'info' : 'warning',
    })
  }

  // DATE_MISMATCH
  if (ocr.payment_date) {
    const payDate = new Date(ocr.payment_date)
    const issueDate = new Date(context.issuedAt)
    const dateValid = payDate >= issueDate
    checks.push({
      check: 'DATE_MISMATCH',
      passed: dateValid,
      expected: `After ${context.issuedAt}`,
      actual: ocr.payment_date,
      severity: dateValid ? 'info' : 'warning',
    })
  }

  // DUPLICATE
  if (ocr.reference_number) {
    const isDuplicate = existingReferenceNumbers.includes(ocr.reference_number)
    checks.push({
      check: 'DUPLICATE',
      passed: !isDuplicate,
      expected: 'Unique reference',
      actual: isDuplicate ? 'Already used' : ocr.reference_number,
      severity: isDuplicate ? 'critical' : 'info',
    })
  }

  return {
    is_valid: checks.every(c => c.passed),
    checks,
  }
}

function fuzzyMatch(a: string, b: string): boolean {
  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')
  return normalize(a).includes(normalize(b)) || normalize(b).includes(normalize(a))
}
```

- [ ] **Step 3: Write Documents API**

`POST /api/documents` — Accepts multipart form data (file + customerId + invoiceId). Stores file (Base64 in DB for demo, or Supabase Storage). Creates document record with `ocr_status: 'PENDING'`. Triggers OCR asynchronously. Returns document record.

`GET /api/documents` — List documents with filters (customerId, ocrStatus). Joins with customer name.

- [ ] **Step 4: Write OCR trigger API**

`POST /api/ocr` — Accepts `{ documentId }`. Reads document, runs `extractPaymentDetails`, runs `validateDocument`, updates document with OCR result + validation result. If validation fails, creates escalation record. Returns updated document.

- [ ] **Step 5: Commit**

```bash
git add app/src/lib/ocr.ts app/src/lib/validation.ts app/src/app/api/documents/ app/src/app/api/ocr/
git commit -m "feat: OCR extraction and AI validation pipeline"
```

### Task 6.2: Document Verification & Escalation Pages

**Files:**
- Create: `app/src/app/api/escalations/route.ts`
- Create: `app/src/app/api/escalations/[id]/route.ts`
- Create: `app/src/app/api/collections/worklist/route.ts`
- Create: `app/src/app/collections/page.tsx`
- Create: `app/src/app/collections/documents/page.tsx`
- Create: `app/src/app/collections/escalations/page.tsx`
- Create: `app/src/components/collections/Worklist.tsx`
- Create: `app/src/components/collections/DocumentVerification.tsx`
- Create: `app/src/components/collections/EscalationQueue.tsx`
- Create: `app/src/components/collections/EscalationReview.tsx`

- [ ] **Step 1: Write Collections Worklist API**

`GET /api/collections/worklist` — Query `invoices` grouped by `customer_id` where `status IN ('OVERDUE', 'PARTIAL')`. Join with `delinquency_scores` for risk_level, `incoming_payments` for last payment date. Return `WorklistItem[]` sorted by total_overdue DESC.

- [ ] **Step 2: Write Escalations API**

`GET /api/escalations` — List escalation records joined with customer name, document, invoice. Filter by status.
`PATCH /api/escalations/[id]` — Update escalation: set status (IN_REVIEW, RESOLVED, DISMISSED), assigned_to, resolution_notes.

- [ ] **Step 3: Write Worklist component**

Table: Customer, Type, Total Overdue (formatted), Oldest Invoice, Risk Level (color badge), Last Payment, Days Overdue. Sortable columns. Click row → navigate to customer detail.

- [ ] **Step 4: Write DocumentVerification component**

Table of uploaded documents: Customer, Invoice #, File Name, OCR Status (badge), Validation (pass/fail), Uploaded At. Click row → shows OCR result panel with extracted fields and validation checks.

- [ ] **Step 5: Write EscalationQueue + EscalationReview**

EscalationQueue: table with Customer, Document, Issue Type (color-coded badge), Status, Assigned To, Created At, Action. Click "Review" opens EscalationReview panel.

EscalationReview: shows AI analysis text, side-by-side comparison (OCR data vs system data), resolution buttons (Accept Anyway, Reject, Request Reupload), resolution notes textarea.

- [ ] **Step 6: Wire up Firebase RTDB for escalation notifications**

When a new escalation is created (in OCR API), write to Firebase RTDB at `collections/escalations/{id}`. In the sidebar, subscribe to RTDB changes and show animated badge on "Collections Mgmt" when new OPEN escalations exist.

- [ ] **Step 7: Commit**

```bash
git add app/src/app/collections/ app/src/app/api/collections/ app/src/app/api/escalations/ app/src/components/collections/
git commit -m "feat: collections worklist, document verification, escalation queue"
```

---

## Chunk 7: Accounts Payable & 3-Way Matching

### Task 7.1: Supplier APIs & Pages

**Files:**
- Create: `app/src/app/api/payable/route.ts`
- Create: `app/src/app/api/payable/[id]/route.ts`
- Create: `app/src/app/api/payable/matching/route.ts`
- Create: `app/src/app/payable/page.tsx`
- Create: `app/src/app/payable/[id]/page.tsx`
- Create: `app/src/app/payable/matching/page.tsx`
- Create: `app/src/components/payable/SupplierList.tsx`
- Create: `app/src/components/payable/SupplierDetail.tsx`
- Create: `app/src/components/payable/ThreeWayMatch.tsx`
- Create: `app/src/components/payable/MatchDetail.tsx`

- [ ] **Step 1: Write Supplier List API**

`GET /api/payable` — Returns suppliers with aggregated payable data. Join with `supplier_invoices` (SUM unpaid), `purchase_orders` (COUNT open), `three_way_matches` (COUNT mismatches). Filter by type, category, search.

- [ ] **Step 2: Write Supplier Detail API**

`GET /api/payable/[id]` — Returns `SupplierDetail` with POs, recent invoices, outgoing payments.

- [ ] **Step 3: Write 3-Way Matching API**

`GET /api/payable/matching` — Returns `ThreeWayMatchRow[]` joined with supplier name, PO number, project name. Filter by match_status, supplier, project.

`PATCH /api/payable/matching` — Update match status (e.g., release blocked invoice → change status to FULL_MATCH after review).

- [ ] **Step 4: Write SupplierList component**

Table: Name, Category, Type (badge), Total Payable, Open POs, Blocked Invoices (red if > 0), Status. Click → supplier detail.

- [ ] **Step 5: Write SupplierDetail component**

Header + PO list + Invoice list. Similar layout to CustomerDetail.

- [ ] **Step 6: Write ThreeWayMatch component**

Table: PO #, Supplier, Project, PO Amount, Receipt Amount, Invoice Amount (highlight if different), Match Status (badge), Payment Status (badge). Click row → opens MatchDetail.

- [ ] **Step 7: Write MatchDetail panel**

Side-by-side columns showing PO details, Receipt details, Invoice details. Discrepancies highlighted in red. AI notes displayed. "Release" button for blocked invoices.

- [ ] **Step 8: Commit**

```bash
git add app/src/app/payable/ app/src/app/api/payable/ app/src/components/payable/
git commit -m "feat: supplier accounts, 3-way matching, GR/IR reconciliation"
```

---

## Chunk 8: AI Chat & ML Pipeline

### Task 8.1: Repurpose Gemini Chat

**Files:**
- Rewrite: `app/src/lib/gemini.ts`
- Rewrite: `app/src/app/chat/page.tsx` → Move to `app/src/app/intelligence/page.tsx`

- [ ] **Step 1: Rewrite gemini.ts**

Update `SCHEMA_DDL` with all new table DDLs (customers, contracts, invoices, incoming_payments, qr_codes, documents, escalations, suppliers, purchase_orders, goods_receipts, supplier_invoices, outgoing_payments, three_way_matches, payer_segments, delinquency_scores, credit_risk_scores, insight_cards, cash_flow_forecasts, payment_patterns).

Update `SYSTEM_PROMPT`:
- "Ayala Land collections assistant" (not JC Supermarket)
- Explain both AR and AP contexts
- Describe 3-way matching queries
- Keep all the same rules (read-only SELECT, etc.)
- Update currency format to PHP
- Update data date range to match seed data

Add summary views to SCHEMA_DDL:
```sql
CREATE VIEW v_customer_overview AS ...;
-- Columns: customer_id, account_number, type, name, property_name, segment_name,
-- delinquency_risk, total_receivable, overdue_amount, last_payment_date

CREATE VIEW v_supplier_overview AS ...;
-- Columns: supplier_id, name, category, type, total_payable, open_pos, blocked_invoices

CREATE VIEW v_three_way_match AS ...;
-- Columns: match_id, po_number, supplier_name, project_name, po_amount, receipt_amount,
-- invoice_amount, match_status, payment_status
```

- [ ] **Step 2: Move chat page**

Move `app/src/app/chat/page.tsx` to `app/src/app/intelligence/page.tsx`. Update any imports. Delete old chat directory.

- [ ] **Step 3: Create insights page**

Create `app/src/app/intelligence/insights/page.tsx` — shows insight cards + delinquency score table + segment distribution chart.

- [ ] **Step 4: Create analytics page**

Create `app/src/app/intelligence/analytics/page.tsx` — shows cash flow forecast chart, collection performance trends, credit risk heatmap. Data from `cash_flow_forecasts`, `incoming_payments` aggregates, `credit_risk_scores`.

- [ ] **Step 5: Commit**

```bash
git add app/src/lib/gemini.ts app/src/app/intelligence/ app/src/app/chat/
git commit -m "feat: repurpose AI chat for collections, add insights and analytics pages"
```

### Task 8.2: Repurpose ML Pipeline

**Files:**
- Rewrite: `ml_pipeline/ml_pipeline/segmentation.py` → payer segmentation
- Rewrite: `ml_pipeline/ml_pipeline/churn_scoring.py` → delinquency scoring
- Keep: `ml_pipeline/ml_pipeline/credit_risk.py` → minor updates
- Rewrite: `ml_pipeline/ml_pipeline/basket_analysis.py` → payment patterns
- Rewrite: `ml_pipeline/ml_pipeline/demand_forecast.py` → cash flow forecast
- Modify: `ml_pipeline/lambda_handler.py`
- Modify: `ml_pipeline/ml_pipeline/db.py`

- [ ] **Step 1: Update db.py**

Update table references for new schema. Add helper functions for the new tables.

- [ ] **Step 2: Rewrite segmentation → payer_segmentation**

Instead of RFM (Recency, Frequency, Monetary), compute:
- Regularity: std deviation of days between payments
- Amount: avg payment vs invoice amount ratio
- Timeliness: avg days from invoice to payment
K-Means clustering on these 3 scores. Write to `payer_segments`.

- [ ] **Step 3: Rewrite churn_scoring → delinquency_scoring**

Features: avg_days_overdue, missed_payment_count, payment_trend (declining/stable/improving), outstanding_balance_ratio. Score 0-1, bucket into LOW/MEDIUM/HIGH/CRITICAL. Write to `delinquency_scores`.

- [ ] **Step 4: Update credit_risk**

Update SQL queries to use new table names. Same logic, write to `credit_risk_scores`.

- [ ] **Step 5: Rewrite basket_analysis → payment_patterns**

Compute per customer: avg_days_to_pay, preferred_method (mode), typical_payment_day (mode of day-of-month), partial_payment_rate. Write to `payment_patterns`.

- [ ] **Step 6: Rewrite demand_forecast → cash_flow_forecast**

Predict monthly inflow (from `incoming_payments`) and outflow (from `outgoing_payments`). Simple time-series projection. Write to `cash_flow_forecasts`.

- [ ] **Step 7: Update lambda_handler**

Update task names and imports to match new modules.

- [ ] **Step 8: Commit**

```bash
git add ml_pipeline/
git commit -m "feat: repurpose ML pipeline for collections domain"
```

---

## Chunk 9: Final Integration & Polish

### Task 9.1: Wire Up All Routes

**Files:**
- Verify all page routes match sidebar navigation links
- Verify all API routes have auth middleware

- [ ] **Step 1: Verify route mapping**

Ensure sidebar navigation items link to correct routes:
- Overview → `/`
- Customer Accounts → `/receivable`
- Incoming Payments → `/receivable/payments`
- Supplier Accounts → `/payable`
- GR/IR Reconciliation → `/payable/matching`
- Collections Worklist → `/collections`
- Document Verification → `/collections/documents`
- Escalation Queue → `/collections/escalations`
- AI Assistant → `/intelligence`
- Insights & Scoring → `/intelligence/insights`
- Analytics → `/intelligence/analytics`

- [ ] **Step 2: Add auth middleware to all API routes**

Wrap all `GET`/`POST`/`PATCH` handlers with `withAuth()` from existing `@/lib/auth-middleware.ts`. Exception: `/api/pay/*` and `/api/qr/verify` are public (no auth).

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: wire up all routes and auth middleware"
```

### Task 9.2: Environment Variables

**Files:**
- Create: `app/.env.example`

- [ ] **Step 1: Document all required env vars**

```
# Supabase
SUPABASE_SQL_PROXY_URL=
SUPABASE_SQL_PROXY_KEY=
DATABASE_URL=

# Firebase
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_DATABASE_URL=
FIREBASE_SERVICE_ACCOUNT=

# Gemini
GEMINI_API_KEY=

# Stripe
STRIPE_SECRET_KEY=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=

# QR JWT
QR_JWT_SECRET=
```

- [ ] **Step 2: Commit**

```bash
git add app/.env.example
git commit -m "docs: add .env.example with all required environment variables"
```

### Task 9.3: Build & Smoke Test

- [ ] **Step 1: Run build**

```bash
cd app && npm run build
```

Fix any TypeScript or build errors.

- [ ] **Step 2: Run dev server and verify each page loads**

```bash
cd app && npm run dev
```

Visit each route, verify no console errors, verify data loads from API.

- [ ] **Step 3: Test QR flow end-to-end**

1. Open emulator → select a customer → select an invoice → Show QR
2. Scan QR with phone → verify payment page opens with correct data
3. Enter test card (4242424242424242) → pay → verify invoice balance updates

- [ ] **Step 4: Test OCR flow**

1. Open emulator → select customer → Upload Proof tab
2. Upload a sample check/receipt image
3. Verify OCR extraction returns fields
4. If mismatch → verify escalation appears in queue

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "fix: resolve build errors and complete integration"
```
