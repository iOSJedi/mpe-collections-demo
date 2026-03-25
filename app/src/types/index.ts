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
  payment_id: number | null
  file_url: string
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
  file_name: string
  invoice_number: string | null
  type: string
  description: string
  ai_analysis: Record<string, unknown> | null
  status: string
  assigned_to: string | null
  resolution_notes: string | null
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

// ─── Penalty & Allocation Types ─────────────────────────────

export interface PenaltyConfig {
  configId: number
  penaltyRatePercent: number
  penaltyFrequency: string
  applicationMethod: 'PENALTIES_FIRST' | 'FIFO'
  gracePeriodDays: number
  depositForfeitDays: number
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
  checkNumber: string | null
  clearanceDate: string | null
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
  excessAmount: number
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
