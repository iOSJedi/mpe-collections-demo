import {
  pgTable, varchar, text, integer, decimal, boolean, date,
  timestamp, serial, jsonb, index, unique,
} from 'drizzle-orm/pg-core'

// ─── ACCOUNTS RECEIVABLE ──────────────────────────────────────

export const customers = pgTable('customers_col', {
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

export const contracts = pgTable('contracts_col', {
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
  index('idx_contracts_customer_col').on(table.customerId),
])

export const invoices = pgTable('invoices_col', {
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
  totalPenalties: decimal('total_penalties', { precision: 12, scale: 2 }).notNull().default('0'),
  penaltiesPaid: decimal('penalties_paid', { precision: 12, scale: 2 }).notNull().default('0'),
  issuedAt: timestamp('issued_at').defaultNow(),
}, (table) => [
  index('idx_invoices_customer_col').on(table.customerId),
  index('idx_invoices_contract_col').on(table.contractId),
  index('idx_invoices_status_col').on(table.status),
  index('idx_invoices_due_date_col').on(table.dueDate),
])

export const incomingPayments = pgTable('incoming_payments_col', {
  paymentId: serial('payment_id').primaryKey(),
  invoiceId: integer('invoice_id').references(() => invoices.invoiceId),
  customerId: integer('customer_id').notNull().references(() => customers.customerId),
  amount: decimal('amount', { precision: 12, scale: 2 }).notNull(),
  paymentMethod: varchar('payment_method', { length: 20 }).notNull(),
  paymentDate: timestamp('payment_date').defaultNow(),
  stripePaymentIntentId: varchar('stripe_payment_intent_id', { length: 200 }),
  referenceNumber: varchar('reference_number', { length: 100 }),
  status: varchar('status', { length: 20 }).notNull().default('PENDING'),
  confirmedAt: timestamp('confirmed_at'),
}, (table) => [
  index('idx_payments_invoice_col').on(table.invoiceId),
  index('idx_payments_customer_col').on(table.customerId),
])

export const qrCodes = pgTable('qr_codes_col', {
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

export const documents = pgTable('documents_col', {
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
  index('idx_documents_customer_col').on(table.customerId),
])

export const escalations = pgTable('escalations_col', {
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
  index('idx_escalations_status_col').on(table.status),
  index('idx_escalations_customer_col').on(table.customerId),
])

// ─── ACCOUNTS PAYABLE ─────────────────────────────────────────

export const suppliers = pgTable('suppliers_col', {
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

export const purchaseOrders = pgTable('purchase_orders_col', {
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
  index('idx_po_supplier_col').on(table.supplierId),
])

export const goodsReceipts = pgTable('goods_receipts_col', {
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
  index('idx_gr_po_col').on(table.poId),
])

export const supplierInvoices = pgTable('supplier_invoices_col', {
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
  workflowStatus: varchar('workflow_status', { length: 30 }).notNull().default('SUBMITTED'),
  claimDocumentUrl: text('claim_document_url'),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => [
  index('idx_si_supplier_col').on(table.supplierId),
  index('idx_si_po_col').on(table.poId),
])

export const outgoingPayments = pgTable('outgoing_payments_col', {
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
  index('idx_op_supplier_invoice_col').on(table.supplierInvoiceId),
])

export const threeWayMatches = pgTable('three_way_matches_col', {
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
  index('idx_twm_status_col').on(table.matchStatus),
  index('idx_twm_supplier_col').on(table.supplierId),
])

// ─── ML OUTPUT TABLES ─────────────────────────────────────────

export const payerSegments = pgTable('payer_segments_col', {
  segmentId: serial('segment_id').primaryKey(),
  customerId: integer('customer_id').notNull().references(() => customers.customerId).unique(),
  segmentName: varchar('segment_name', { length: 50 }).notNull(),
  regularityScore: decimal('regularity_score', { precision: 5, scale: 2 }).notNull(),
  amountScore: decimal('amount_score', { precision: 5, scale: 2 }).notNull(),
  timelinessScore: decimal('timeliness_score', { precision: 5, scale: 2 }).notNull(),
  clusterId: integer('cluster_id').notNull(),
  scoredAt: timestamp('scored_at').defaultNow(),
})

export const delinquencyScores = pgTable('delinquency_scores_col', {
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
  index('idx_delinquency_risk_col').on(table.riskLevel),
])

export const creditRiskScores = pgTable('credit_risk_scores_col', {
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
  index('idx_credit_risk_level_col').on(table.riskLevel),
])

export const insightCards = pgTable('insight_cards_col', {
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
  index('idx_insight_cards_active_col').on(table.isActive, table.createdAt),
])

export const cashFlowForecasts = pgTable('cash_flow_forecasts_col', {
  forecastId: serial('forecast_id').primaryKey(),
  forecastDate: date('forecast_date').notNull(),
  predictedInflow: decimal('predicted_inflow', { precision: 14, scale: 2 }).notNull(),
  predictedOutflow: decimal('predicted_outflow', { precision: 14, scale: 2 }).notNull(),
  confidenceLower: decimal('confidence_lower', { precision: 14, scale: 2 }),
  confidenceUpper: decimal('confidence_upper', { precision: 14, scale: 2 }),
  basedOnPeriod: varchar('based_on_period', { length: 50 }),
  createdAt: timestamp('created_at').defaultNow(),
})

export const paymentPatterns = pgTable('payment_patterns_col', {
  patternId: serial('pattern_id').primaryKey(),
  customerId: integer('customer_id').notNull().references(() => customers.customerId).unique(),
  avgDaysToPay: decimal('avg_days_to_pay', { precision: 6, scale: 1 }),
  preferredMethod: varchar('preferred_method', { length: 20 }),
  typicalPaymentDay: integer('typical_payment_day'),
  partialPaymentRate: decimal('partial_payment_rate', { precision: 5, scale: 2 }),
  scoredAt: timestamp('scored_at').defaultNow(),
})

// ─── PENALTY & PAYMENT ALLOCATION ────────────────────────────

export const penaltyConfig = pgTable('penalty_config_col', {
  configId: serial('config_id').primaryKey(),
  penaltyRatePercent: decimal('penalty_rate_percent', { precision: 5, scale: 2 }).notNull().default('2.0'),
  penaltyFrequency: varchar('penalty_frequency', { length: 20 }).notNull().default('MONTHLY'),
  applicationMethod: varchar('application_method', { length: 20 }).notNull().default('PENALTIES_FIRST'),
  gracePeriodDays: integer('grace_period_days').notNull().default(0),
  updatedAt: timestamp('updated_at').defaultNow(),
})

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
