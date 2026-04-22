import { db } from '@/db'
import { sql, eq } from 'drizzle-orm'
import * as schema from '@/db/schema'
import { referenceNumberFor } from './cwt/reference'
import {
  penaltyConfig, penaltyLedger, paymentAllocations, apWorkflowEvents,
  creditLedger, securityDeposits, depositForfeitures, milestoneTemplates, poMilestones,
} from '@/db/schema'

// Aliases for tables used in new seed steps (the rest use `schema.*`)
const { invoices, incomingPayments, supplierInvoices, purchaseOrders, suppliers } = schema

// ─── Chunked insert helper (proxy has ~200 param limit) ──────────────────────

async function chunkedInsert<T extends Record<string, unknown>>(
  table: Parameters<typeof db.insert>[0],
  rows: T[],
  chunkSize = 20,
): Promise<void> {
  for (let i = 0; i < rows.length; i += chunkSize) {
    await (db.insert(table) as any).values(rows.slice(i, i + chunkSize))
  }
}

async function chunkedInsertReturning<T extends Record<string, unknown>>(
  table: Parameters<typeof db.insert>[0],
  rows: T[],
  chunkSize = 20,
): Promise<any[]> {
  const results: any[] = []
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = await (db.insert(table) as any).values(rows.slice(i, i + chunkSize)).returning()
    results.push(...chunk)
  }
  return results
}

// ─── Seeded PRNG (Mulberry32) ─────────────────────────────────────────────────

let _seed = 42
function resetSeed(s: number) { _seed = s }
function rand(): number {
  _seed |= 0
  _seed = (_seed + 0x6d2b79f5) | 0
  let t = Math.imul(_seed ^ (_seed >>> 15), 1 | _seed)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}
function randInt(min: number, max: number): number {
  return Math.floor(rand() * (max - min + 1)) + min
}
function pick<T>(arr: T[]): T {
  return arr[Math.floor(rand() * arr.length)]
}
function pickWeighted<T>(items: T[], weights: number[]): T {
  const total = weights.reduce((a, b) => a + b, 0)
  let r = rand() * total
  for (let i = 0; i < items.length; i++) {
    r -= weights[i]
    if (r <= 0) return items[i]
  }
  return items[items.length - 1]
}

// ─── Date Helpers ─────────────────────────────────────────────────────────────

function fmtDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}
function addDays(d: Date, days: number): Date {
  const r = new Date(d)
  r.setDate(r.getDate() + days)
  return r
}
function addMonths(d: Date, months: number): Date {
  const r = new Date(d)
  r.setMonth(r.getMonth() + months)
  return r
}
function startOfMonth(year: number, month: number): Date {
  return new Date(year, month - 1, 1)
}
function endOfMonth(year: number, month: number): Date {
  return new Date(year, month, 0)
}

// ─── Static Data ──────────────────────────────────────────────────────────────

interface TenantSpec {
  name: string
  businessType: string
  property: string
  unit: string
  monthlyMin: number
  monthlyMax: number
}

const TENANT_SPECS: TenantSpec[] = [
  // Greenbelt
  { name: 'Uniqlo Philippines Inc.', businessType: 'Apparel Retail', property: 'Greenbelt 5', unit: 'L2-G501', monthlyMin: 800_000, monthlyMax: 1_200_000 },
  { name: 'Zara Philippines (Inditex Group)', businessType: 'Apparel Retail', property: 'Greenbelt 3', unit: 'L2-G302', monthlyMin: 900_000, monthlyMax: 1_400_000 },
  { name: 'H&M Philippines (Fast Retailing)', businessType: 'Apparel Retail', property: 'Greenbelt 5', unit: 'L1-G503', monthlyMin: 700_000, monthlyMax: 1_100_000 },
  { name: 'Apple Philippines (Authorized Retailer)', businessType: 'Consumer Electronics', property: 'Greenbelt 4', unit: 'L1-G401', monthlyMin: 1_500_000, monthlyMax: 2_500_000 },
  { name: 'Pottery Barn Philippines', businessType: 'Home Furnishings', property: 'Greenbelt 5', unit: 'L3-G502', monthlyMin: 500_000, monthlyMax: 800_000 },
  { name: 'Samsung Experience Store', businessType: 'Consumer Electronics', property: 'Greenbelt 3', unit: 'L1-G303', monthlyMin: 600_000, monthlyMax: 900_000 },
  // Glorietta
  { name: 'Jollibee Foods Corporation – Glorietta', businessType: 'Quick Service Restaurant', property: 'Glorietta 1', unit: 'GF-GL101', monthlyMin: 200_000, monthlyMax: 400_000 },
  { name: "McDonald's Philippines – Glorietta", businessType: 'Quick Service Restaurant', property: 'Glorietta 2', unit: 'GF-GL201', monthlyMin: 220_000, monthlyMax: 420_000 },
  { name: 'Bank of the Philippine Islands – Glorietta', businessType: 'Banking & Finance', property: 'Glorietta 4', unit: 'L1-GL401', monthlyMin: 300_000, monthlyMax: 500_000 },
  { name: 'Mercury Drug – Glorietta', businessType: 'Pharmacy', property: 'Glorietta 2', unit: 'GF-GL202', monthlyMin: 150_000, monthlyMax: 250_000 },
  { name: 'National Bookstore – Glorietta', businessType: 'Books & Stationery', property: 'Glorietta 1', unit: 'L2-GL102', monthlyMin: 250_000, monthlyMax: 400_000 },
  { name: 'Watsons Personal Care – Glorietta', businessType: 'Health & Beauty', property: 'Glorietta 3', unit: 'GF-GL301', monthlyMin: 180_000, monthlyMax: 320_000 },
  // Ayala Triangle Gardens / Tower One
  { name: 'JP Morgan Chase Bank N.A. – Manila', businessType: 'Banking & Finance', property: 'Tower One & Exchange Plaza', unit: '28F-T1', monthlyMin: 1_200_000, monthlyMax: 2_000_000 },
  { name: 'Accenture Inc. Philippines', businessType: 'IT & Business Consulting', property: 'Ayala Triangle Gardens Tower 1', unit: '10F-ATG1', monthlyMin: 1_000_000, monthlyMax: 1_800_000 },
  { name: 'Deloitte Philippines (Navarro Amper & Co.)', businessType: 'Audit & Consulting', property: 'Ayala Triangle Gardens Tower 2', unit: '15F-ATG2', monthlyMin: 800_000, monthlyMax: 1_400_000 },
  { name: 'McKinsey & Company Philippines', businessType: 'Management Consulting', property: 'Tower One & Exchange Plaza', unit: '30F-T1', monthlyMin: 1_100_000, monthlyMax: 1_900_000 },
  // One Ayala
  { name: 'Globe Telecom Inc.', businessType: 'Telecommunications', property: 'One Ayala East Tower', unit: '20F-OA-E', monthlyMin: 900_000, monthlyMax: 1_500_000 },
  { name: 'Smart Communications Inc. (PLDT Group)', businessType: 'Telecommunications', property: 'One Ayala West Tower', unit: '18F-OA-W', monthlyMin: 850_000, monthlyMax: 1_450_000 },
  { name: 'Fully Booked Holdings Inc.', businessType: 'Books & Media Retail', property: 'One Ayala Mall', unit: 'L1-OA-M01', monthlyMin: 200_000, monthlyMax: 380_000 },
  // Ayala Malls Manila Bay
  { name: 'IKEA Philippines (IKEA Southeast Asia)', businessType: 'Home Furnishings & Retail', property: 'IKEA Manila Bay', unit: 'IKEA-MB-01', monthlyMin: 2_000_000, monthlyMax: 2_500_000 },
  { name: 'Decathlon Philippines', businessType: 'Sports Goods Retail', property: 'Ayala Malls Manila Bay', unit: 'L1-MB201', monthlyMin: 500_000, monthlyMax: 900_000 },
  { name: 'H&M Home Philippines', businessType: 'Home Textile Retail', property: 'Ayala Malls Manila Bay', unit: 'L2-MB202', monthlyMin: 350_000, monthlyMax: 600_000 },
  // Ayala Center Cebu
  { name: "Bo's Coffee Club Inc.", businessType: 'Specialty Coffee', property: 'Ayala Center Cebu', unit: 'GF-ACC101', monthlyMin: 80_000, monthlyMax: 150_000 },
  { name: 'Bench (Basic Editions Philippine Corp.)', businessType: 'Apparel Retail', property: 'Ayala Center Cebu', unit: 'L1-ACC201', monthlyMin: 200_000, monthlyMax: 380_000 },
  { name: 'Penshoppe (Golden ABC Inc.)', businessType: 'Apparel Retail', property: 'Ayala Center Cebu', unit: 'L1-ACC202', monthlyMin: 180_000, monthlyMax: 350_000 },
  // Nuvali
  { name: 'S&R Membership Shopping – Nuvali', businessType: 'Membership Warehouse Retail', property: 'Nuvali Commercial District', unit: 'NUV-SR-01', monthlyMin: 600_000, monthlyMax: 1_000_000 },
  { name: 'Solenad Cinemas (Ayala Malls Cinemas)', businessType: 'Cinema & Entertainment', property: 'Solenad 3, Nuvali', unit: 'L3-SOL-CIN', monthlyMin: 300_000, monthlyMax: 550_000 },
  // Circuit Makati
  { name: 'True Value Hardware – Circuit Makati', businessType: 'Hardware Retail', property: 'Circuit Makati', unit: 'L1-CKT-101', monthlyMin: 180_000, monthlyMax: 300_000 },
  { name: 'Ace Hardware Philippines – Circuit', businessType: 'Hardware Retail', property: 'Circuit Makati', unit: 'L1-CKT-102', monthlyMin: 200_000, monthlyMax: 350_000 },
  { name: 'Landers Superstore – Circuit Makati', businessType: 'Membership Superstore', property: 'Circuit Makati', unit: 'L1-CKT-LND', monthlyMin: 700_000, monthlyMax: 1_200_000 },
]

const PROPERTY_MANAGER_NAMES = [
  'DMCI Homes Property Management',
  'Megaworld Property Management',
  'Federal Land Property Management',
  'Robinsons Land Property Management',
  'Filinvest Property Management',
  'Alveo Land Property Management',
  'Avida Land Property Management',
  'SMDC Property Management',
  'Vista Land Property Management',
  'Shang Properties Management',
  'Century Properties Management',
  'Rockwell Land Property Management',
  'Ortigas & Company',
  'Net Lima Property Management',
  'Eton Properties Management',
  'Cathay Land Property Management',
  'Empire East Property Management',
  'Global Estate Resorts Management',
  'Sta. Lucia Land Property Management',
  'Primex Realty Management',
]

interface SupplierSpec {
  name: string
  category: string
  type: string
  contactPrefix: string
}

const SUPPLIER_SPECS: SupplierSpec[] = [
  { name: 'Megawide Construction Corporation', category: 'Construction', type: 'General Contractor', contactPrefix: 'procurement' },
  { name: 'DMCI Holdings Inc.', category: 'Construction', type: 'General Contractor', contactPrefix: 'ap' },
  { name: 'EEI Corporation', category: 'Engineering & Construction', type: 'Engineering Contractor', contactPrefix: 'billing' },
  { name: 'First Balfour Inc.', category: 'Civil Works', type: 'Civil Contractor', contactPrefix: 'contracts' },
  { name: 'Makati Development Corporation', category: 'Construction', type: 'General Contractor', contactPrefix: 'finance' },
  { name: 'Monark Equipment Corporation', category: 'Heavy Equipment', type: 'Equipment Supplier', contactPrefix: 'sales' },
  { name: 'Holcim Philippines Inc.', category: 'Cement & Materials', type: 'Materials Supplier', contactPrefix: 'orders' },
  { name: 'Republic Cement & Building Materials Inc.', category: 'Cement & Materials', type: 'Materials Supplier', contactPrefix: 'trade' },
  { name: 'Phinma Steel Corporation', category: 'Steel & Metal', type: 'Steel Supplier', contactPrefix: 'accounts' },
  { name: 'SteelAsia Manufacturing Corporation', category: 'Steel & Metal', type: 'Steel Supplier', contactPrefix: 'billing' },
  { name: 'Schneider Electric Philippines Inc.', category: 'Electrical Systems', type: 'MEP Supplier', contactPrefix: 'projects' },
  { name: 'Siemens Philippines Inc.', category: 'Electrical & Automation', type: 'MEP Supplier', contactPrefix: 'ap' },
  { name: 'Carrier Philippines Inc.', category: 'HVAC', type: 'HVAC Supplier', contactPrefix: 'service' },
  { name: 'Daikin Philippines Inc.', category: 'HVAC', type: 'HVAC Supplier', contactPrefix: 'commercial' },
  { name: 'Otis Elevator Company Philippines', category: 'Elevators & Lifts', type: 'Vertical Transport Supplier', contactPrefix: 'contracts' },
  { name: 'Kone Philippines Inc.', category: 'Elevators & Escalators', type: 'Vertical Transport Supplier', contactPrefix: 'projects' },
  { name: 'JG Summit Petrochemicals Group', category: 'Petrochemicals & Materials', type: 'Materials Supplier', contactPrefix: 'b2b' },
  { name: 'Boysen Paints Philippines (Pacific Paint)', category: 'Paints & Coatings', type: 'Finishes Supplier', contactPrefix: 'trade' },
  { name: 'Wilcon Depot Inc.', category: 'Building Materials', type: 'Building Materials Retailer', contactPrefix: 'corporate' },
  { name: 'AllHome Corporation', category: 'Interior Finishes', type: 'Interior Finishes Supplier', contactPrefix: 'procurement' },
]

const AYALA_PROJECTS = [
  'One Ayala',
  'Parklinks',
  'Arca South',
  'Circuit Makati',
  'Vermosa',
  'Nuvali Phase 5',
  'Alviera',
  'Vertis North Phase 2',
  'The Greenways',
  'Cloverleaf',
]

const PAYMENT_METHODS = ['BANK_TRANSFER', 'CHECK', 'ONLINE', 'AUTO_DEBIT']
const SUPPLIER_PAYMENT_METHODS = ['BANK_TRANSFER', 'CHECK', 'WIRE']

// ─── Billing Months: Oct 2025 – Mar 2026 ────────────────────────────────────

const BILLING_MONTHS = [
  { year: 2025, month: 10 },
  { year: 2025, month: 11 },
  { year: 2025, month: 12 },
  { year: 2026, month: 1 },
  { year: 2026, month: 2 },
  { year: 2026, month: 3 },
]

// ─── PRNG seed offsets per stage (ensures each stage starts at a fixed state) ─

const STAGE_SEEDS = {
  1: 42,
  2: 1000,
  3: 2000,
  4: 3000,
  5: 4000,
}

// ─── Stage 1: Truncate, schema migration, customers, contracts, invoices, payments ─

export async function seedStage1() {
  resetSeed(STAGE_SEEDS[1])
  console.log('Stage 1: truncate + customers + contracts + invoices + payments')

  // ── 0. TRUNCATE ALL TABLES (idempotent re-run) ─────────────────────────────

  // Ensure columns exist (idempotent ALTER TABLEs)
  await db.execute(sql.raw('ALTER TABLE supplier_invoices_col ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW()'))
  await db.execute(sql.raw('ALTER TABLE invoices_col ADD COLUMN IF NOT EXISTS total_penalties DECIMAL(12,2) NOT NULL DEFAULT 0; ALTER TABLE invoices_col ADD COLUMN IF NOT EXISTS penalties_paid DECIMAL(12,2) NOT NULL DEFAULT 0; ALTER TABLE supplier_invoices_col ADD COLUMN IF NOT EXISTS workflow_status VARCHAR(30) NOT NULL DEFAULT \'SUBMITTED\'; ALTER TABLE supplier_invoices_col ADD COLUMN IF NOT EXISTS claim_document_url TEXT; ALTER TABLE incoming_payments_col ALTER COLUMN invoice_id DROP NOT NULL; ALTER TABLE customers_col ADD COLUMN IF NOT EXISTS credit_balance DECIMAL(12,2) NOT NULL DEFAULT 0; ALTER TABLE invoices_col ADD COLUMN IF NOT EXISTS deposit_forfeiture_flag VARCHAR(20); ALTER TABLE incoming_payments_col ADD COLUMN IF NOT EXISTS check_number VARCHAR(50); ALTER TABLE incoming_payments_col ADD COLUMN IF NOT EXISTS clearance_date DATE; ALTER TABLE penalty_config_col ADD COLUMN IF NOT EXISTS deposit_forfeit_days INTEGER NOT NULL DEFAULT 90'))

  console.log('Truncating all tables...')
  await db.execute(sql.raw('TRUNCATE TABLE credit_ledger_col, security_deposits_col, deposit_forfeitures_col, milestone_templates_col, po_milestones_col, penalty_config_col, penalty_ledger_col, payment_allocations_col, ap_workflow_events_col, cash_flow_forecasts_col, escalations_col, documents_col, insight_cards_col, payment_patterns_col, credit_risk_scores_col, delinquency_scores_col, payer_segments_col, three_way_matches_col, outgoing_payments_col, supplier_invoices_col, goods_receipts_col, purchase_orders_col, suppliers_col, incoming_payments_col, qr_codes_col, invoices_col, contracts_col, customers_col RESTART IDENTITY CASCADE'))
  console.log('  Tables truncated')

  // ── 1. INSERT CUSTOMERS ────────────────────────────────────────────────────

  console.log('Inserting 30 tenant customers...')
  const tenantRows = TENANT_SPECS.map((t, i) => ({
    accountNumber: `TEN${String(i + 1).padStart(4, '0')}`,
    type: 'TENANT',
    name: t.name,
    contactPerson: `${pick(['Maria', 'Jose', 'Ana', 'Carlos', 'Liza', 'Mark', 'Grace', 'Ryan'])} ${pick(['Santos', 'Reyes', 'Cruz', 'Garcia', 'Dela Cruz', 'Mendoza', 'Torres', 'Lim'])}`,
    email: `billing@${t.name.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 20)}.ph`,
    phone: `+639${randInt(10, 99)}${randInt(1000000, 9999999)}`,
    businessType: t.businessType,
    propertyName: t.property,
    unitInfo: t.unit,
    status: 'ACTIVE',
  }))

  const insertedTenants = await db.insert(schema.customers).values(tenantRows).returning()
  console.log(`  Inserted ${insertedTenants.length} tenants`)

  console.log('Inserting 20 property manager customers...')
  const pmRows = PROPERTY_MANAGER_NAMES.map((name, i) => ({
    accountNumber: `PM${String(i + 1).padStart(4, '0')}`,
    type: 'PROPERTY_MANAGER',
    name,
    contactPerson: `${pick(['Roberto', 'Maricel', 'Ferdinand', 'Cecilia', 'Jerome', 'Natividad', 'Oscar', 'Lorena'])} ${pick(['Villanueva', 'Fernandez', 'Castillo', 'Aquino', 'Bautista', 'Ramos', 'Pascual', 'Aguilar'])}`,
    email: `accounts@${name.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 22)}.com`,
    phone: `+632${randInt(8000, 8999)}${randInt(1000, 9999)}`,
    businessType: 'Property Management',
    propertyName: `${name.replace(' Property Management', '').replace(' Management', '')} Portfolio`,
    unitInfo: 'Main Office',
    status: 'ACTIVE',
  }))

  const insertedPMs = await db.insert(schema.customers).values(pmRows).returning()
  console.log(`  Inserted ${insertedPMs.length} property managers`)

  const allCustomers = [...insertedTenants, ...insertedPMs]

  // ── 2. INSERT CONTRACTS ────────────────────────────────────────────────────

  console.log('Inserting contracts (1-2 per customer)...')
  const contractRows: (typeof schema.contracts.$inferInsert)[] = []
  let contractCounter = 1

  for (let ci = 0; ci < allCustomers.length; ci++) {
    const cust = allCustomers[ci]
    const numContracts = ci < 10 ? 2 : 1
    const isTenant = cust.type === 'TENANT'
    const tenantSpec = isTenant ? TENANT_SPECS[ci] : null

    for (let k = 0; k < numContracts; k++) {
      const contractNum = `ALI-CTR-${String(contractCounter).padStart(5, '0')}`
      const startDate = new Date(2023, randInt(0, 3), 1)
      const endDate = addMonths(startDate, randInt(24, 60))
      const monthly = isTenant && tenantSpec
        ? randInt(tenantSpec.monthlyMin, tenantSpec.monthlyMax)
        : randInt(50_000, 300_000)

      contractRows.push({
        customerId: cust.customerId!,
        contractNumber: contractNum,
        type: isTenant ? (k === 0 ? 'LEASE' : 'CONCESSION') : 'SERVICE',
        description: isTenant
          ? `${k === 0 ? 'Retail space lease' : 'Concession rights'} for ${cust.propertyName} ${cust.unitInfo}`
          : `Property management services agreement — ${cust.name}`,
        monthlyAmount: String(monthly),
        startDate: fmtDate(startDate),
        endDate: fmtDate(endDate),
        status: 'ACTIVE',
      })
      contractCounter++
    }
  }

  const insertedContracts = await chunkedInsertReturning(schema.contracts, contractRows)
  console.log(`  Inserted ${insertedContracts.length} contracts`)

  // ── 3. INSERT INVOICES ─────────────────────────────────────────────────────

  console.log('Inserting invoices...')
  const invoiceRows: (typeof schema.invoices.$inferInsert)[] = []
  let invoiceCounter = 1

  const paymentProfiles = allCustomers.map(() => {
    const r = rand()
    if (r < 0.35) return 0
    if (r < 0.60) return 1
    if (r < 0.78) return 2
    if (r < 0.90) return 3
    return 4
  })

  for (const contract of insertedContracts) {
    const numMonths = randInt(3, 6)
    const monthsSlice = BILLING_MONTHS.slice(0, numMonths)

    for (const { year, month } of monthsSlice) {
      const periodStart = startOfMonth(year, month)
      const periodEnd = endOfMonth(year, month)
      const dueDate = addDays(periodEnd, 15)
      const amount = Number(contract.monthlyAmount)
      const invoiceNum = `INV-${year}${String(month).padStart(2, '0')}-${String(invoiceCounter).padStart(5, '0')}`

      const custIndex = allCustomers.findIndex(c => c.customerId === contract.customerId)
      const profile = paymentProfiles[custIndex] ?? 0
      const now = new Date('2026-03-10')
      const isPast = dueDate < now

      let status: string
      let balanceRemaining: number

      if (!isPast) {
        status = 'PENDING'
        balanceRemaining = amount
      } else {
        const r = rand()
        if (profile === 0) {
          status = 'PAID'
          balanceRemaining = 0
        } else if (profile === 1) {
          if (r < 0.85) { status = 'PAID'; balanceRemaining = 0 }
          else if (r < 0.95) { status = 'PARTIAL'; balanceRemaining = amount * randInt(10, 40) / 100 }
          else { status = 'OVERDUE'; balanceRemaining = amount }
        } else if (profile === 2) {
          if (r < 0.65) { status = 'PAID'; balanceRemaining = 0 }
          else if (r < 0.82) { status = 'PARTIAL'; balanceRemaining = amount * randInt(20, 60) / 100 }
          else { status = 'OVERDUE'; balanceRemaining = amount }
        } else if (profile === 3) {
          if (r < 0.40) { status = 'PAID'; balanceRemaining = 0 }
          else if (r < 0.65) { status = 'PARTIAL'; balanceRemaining = amount * randInt(30, 70) / 100 }
          else { status = 'OVERDUE'; balanceRemaining = amount }
        } else {
          if (r < 0.15) { status = 'PAID'; balanceRemaining = 0 }
          else if (r < 0.35) { status = 'PARTIAL'; balanceRemaining = amount * randInt(50, 90) / 100 }
          else { status = 'OVERDUE'; balanceRemaining = amount }
        }
      }

      invoiceRows.push({
        contractId: contract.contractId!,
        customerId: contract.customerId,
        invoiceNumber: invoiceNum,
        billingPeriodStart: fmtDate(periodStart),
        billingPeriodEnd: fmtDate(periodEnd),
        dueDate: fmtDate(dueDate),
        amount: String(amount.toFixed(2)),
        balanceRemaining: String(balanceRemaining.toFixed(2)),
        status,
      })
      invoiceCounter++
    }
  }

  const insertedInvoices = await chunkedInsertReturning(schema.invoices, invoiceRows)
  console.log(`  Inserted ${insertedInvoices.length} invoices`)

  // ── 4. INSERT INCOMING PAYMENTS ───────────────────────────────────────────

  console.log('Inserting incoming payments...')
  const paymentRows: (typeof schema.incomingPayments.$inferInsert)[] = []
  let paymentCounter = 1

  for (const inv of insertedInvoices) {
    if (inv.status === 'PAID' || inv.status === 'PARTIAL') {
      const amountPaid = inv.status === 'PAID'
        ? Number(inv.amount)
        : Number(inv.amount) - Number(inv.balanceRemaining)

      const dueDate = new Date(inv.dueDate!)
      const daysEarly = inv.status === 'PAID' ? randInt(-5, 10) : randInt(0, 20)
      const paymentDate = addDays(dueDate, daysEarly)
      const refNum = `REF${String(paymentCounter).padStart(8, '0')}`

      paymentRows.push({
        invoiceId: inv.invoiceId!,
        customerId: inv.customerId,
        amount: String(amountPaid.toFixed(2)),
        paymentMethod: pick(PAYMENT_METHODS),
        paymentDate: paymentDate,
        referenceNumber: refNum,
        status: 'CONFIRMED',
        confirmedAt: paymentDate,
      })
      paymentCounter++
    }
  }

  await chunkedInsertReturning(schema.incomingPayments, paymentRows)
  console.log(`  Inserted ${paymentRows.length} incoming payments`)

  console.log('Stage 1 complete')
}

// ─── Stage 2: Suppliers, POs, goods receipts, supplier invoices, outgoing payments, 3-way matches ─

export async function seedStage2() {
  resetSeed(STAGE_SEEDS[2])
  console.log('Stage 2: suppliers + POs + GRs + supplier invoices + outgoing payments + 3-way matches')

  // ── 5. INSERT SUPPLIERS ────────────────────────────────────────────────────

  console.log('Inserting 20 suppliers...')
  const supplierRows = SUPPLIER_SPECS.map((s) => ({
    name: s.name,
    category: s.category,
    type: s.type,
    contactPerson: `${pick(['Antonio', 'Maria', 'Ramon', 'Josefina', 'Eduardo', 'Corazon', 'Benjamin', 'Estrella'])} ${pick(['Dela Torre', 'Evangelista', 'Gutierrez', 'Herrera', 'Jimenez', 'Lacson', 'Medina', 'Navarro'])}`,
    email: `${s.contactPrefix}@${s.name.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 20)}.com.ph`,
    phone: `+632${randInt(8200, 8999)}${randInt(1000, 9999)}`,
    taxId: `${randInt(100, 999)}-${randInt(100, 999)}-${randInt(100, 999)}-${randInt(10000, 99999)}`,
    bankDetails: JSON.stringify({
      bank: pick(['BDO Unibank', 'BPI', 'Metrobank', 'RCBC', 'UnionBank', 'Security Bank']),
      accountName: s.name,
      accountNumber: `${randInt(1000000000, 9999999999)}`,
      branch: pick(['Makati CBD', 'BGC', 'Ortigas Center', 'Quezon City Main', 'Pasig City']),
    }),
    status: 'ACTIVE',
  }))

  const insertedSuppliers = await db.insert(schema.suppliers).values(supplierRows).returning()
  console.log(`  Inserted ${insertedSuppliers.length} suppliers`)

  // ── 6. INSERT PURCHASE ORDERS ─────────────────────────────────────────────

  console.log('Inserting purchase orders...')
  const poRows: (typeof schema.purchaseOrders.$inferInsert)[] = []
  let poCounter = 1

  for (const supplier of insertedSuppliers) {
    const numPOs = randInt(2, 3)
    for (let k = 0; k < numPOs; k++) {
      const poNum = `PO-ALI-${String(poCounter).padStart(6, '0')}`
      const project = pick(AYALA_PROJECTS)
      const issuedDate = new Date(2025, randInt(6, 9), randInt(1, 28))
      const deliveryDays = randInt(60, 180)
      const amount = randInt(200_000, 5_000_000)

      const expectedDelivery = addDays(issuedDate, deliveryDays)
      const now = new Date('2026-03-10')
      let poStatus: string
      if (expectedDelivery < now && rand() > 0.2) {
        poStatus = pickWeighted(['CLOSED', 'RECEIVED', 'PARTIAL'], [50, 30, 20])
      } else {
        poStatus = pickWeighted(['OPEN', 'APPROVED', 'PARTIAL'], [40, 40, 20])
      }

      poRows.push({
        poNumber: poNum,
        supplierId: supplier.supplierId!,
        projectName: project,
        description: `Supply of ${supplier.category} for ${project} — Phase ${randInt(1, 3)}`,
        totalAmount: String(amount.toFixed(2)),
        issuedDate: fmtDate(issuedDate),
        expectedDelivery: fmtDate(expectedDelivery),
        status: poStatus,
      })
      poCounter++
    }
  }

  const insertedPOs = await db.insert(schema.purchaseOrders).values(poRows).returning()
  console.log(`  Inserted ${insertedPOs.length} purchase orders`)

  // ── 7. INSERT GOODS RECEIPTS ──────────────────────────────────────────────

  console.log('Inserting goods receipts...')
  const grRows: (typeof schema.goodsReceipts.$inferInsert)[] = []
  let grCounter = 1

  for (const po of insertedPOs) {
    if (['RECEIVED', 'CLOSED', 'PARTIAL'].includes(po.status)) {
      const numGRs = po.status === 'PARTIAL' ? 1 : randInt(1, 2)
      for (let k = 0; k < numGRs; k++) {
        const receivedDate = addDays(new Date(po.issuedDate!), randInt(30, 120))
        const pctReceived = po.status === 'PARTIAL' ? randInt(40, 80) / 100 : (k === 0 && numGRs === 2 ? 0.6 : 1.0)
        const amount = Number(po.totalAmount) * pctReceived

        grRows.push({
          poId: po.poId!,
          supplierId: po.supplierId,
          receiptNumber: `GR-${String(grCounter).padStart(6, '0')}`,
          receivedDate: fmtDate(receivedDate),
          receivedBy: `${pick(['Rodolfo', 'Mylene', 'Arsenio', 'Divina', 'Renato'])} ${pick(['Padua', 'Quizon', 'Rebollos', 'Sagun', 'Tacloban'])}`,
          description: `Goods receipt for ${po.description ?? po.projectName}`,
          quantityReceived: String((pctReceived * 100).toFixed(2)),
          unit: pick(['MT', 'UNITS', 'SQFT', 'SQM', 'LOT', 'SETS']),
          amount: String(amount.toFixed(2)),
          conditionNotes: pickWeighted(
            ['All items in good condition', 'Minor packaging damage, items intact', 'Complete and verified', null],
            [60, 15, 20, 5]
          ),
        })
        grCounter++
      }
    }
  }

  const insertedGRs = await chunkedInsertReturning(schema.goodsReceipts, grRows)
  console.log(`  Inserted ${insertedGRs.length} goods receipts`)

  // ── 8. INSERT SUPPLIER INVOICES ───────────────────────────────────────────

  console.log('Inserting supplier invoices...')
  const siRows: (typeof schema.supplierInvoices.$inferInsert)[] = []
  let siCounter = 1

  for (const gr of insertedGRs) {
    const submittedDate = addDays(new Date(gr.receivedDate!), randInt(5, 21))
    const dueDate = addDays(submittedDate, 30)
    const amount = Number(gr.amount)
    const now = new Date('2026-03-10')
    const isPast = dueDate < now

    let paymentStatus: string
    let amountPaid: number
    let paymentDate: string | null = null

    if (!isPast) {
      paymentStatus = 'UNPAID'
      amountPaid = 0
    } else {
      const r = rand()
      if (r < 0.65) {
        paymentStatus = 'PAID'
        amountPaid = amount
        paymentDate = fmtDate(addDays(dueDate, randInt(-5, 10)))
      } else if (r < 0.82) {
        paymentStatus = 'PARTIAL'
        amountPaid = amount * randInt(40, 80) / 100
        paymentDate = null
      } else {
        paymentStatus = 'UNPAID'
        amountPaid = 0
      }
    }

    siRows.push({
      supplierId: gr.supplierId,
      poId: gr.poId,
      invoiceNumber: `SINV-${String(siCounter).padStart(6, '0')}`,
      amount: String(amount.toFixed(2)),
      submittedDate: fmtDate(submittedDate),
      dueDate: fmtDate(dueDate),
      paymentStatus,
      amountPaid: String(amountPaid.toFixed(2)),
      paymentDate,
    })
    siCounter++
  }

  const insertedSIs = await chunkedInsertReturning(schema.supplierInvoices, siRows)
  console.log(`  Inserted ${insertedSIs.length} supplier invoices`)

  // ── 9. INSERT OUTGOING PAYMENTS ───────────────────────────────────────────

  console.log('Inserting outgoing payments...')
  const opRows: (typeof schema.outgoingPayments.$inferInsert)[] = []
  let opCounter = 1

  for (const si of insertedSIs) {
    if (si.paymentStatus === 'PAID' || si.paymentStatus === 'PARTIAL') {
      const amount = Number(si.amountPaid)
      const payDate = si.paymentDate ? new Date(si.paymentDate) : addDays(new Date(si.dueDate!), randInt(0, 15))

      opRows.push({
        supplierInvoiceId: si.supplierInvoiceId!,
        supplierId: si.supplierId,
        amount: String(amount.toFixed(2)),
        paymentMethod: pick(SUPPLIER_PAYMENT_METHODS),
        paymentDate: payDate,
        referenceNumber: `OP-REF-${String(opCounter).padStart(7, '0')}`,
        approvedBy: `${pick(['Roberto', 'Josephine', 'Victor', 'Amelia'])} ${pick(['Santos', 'Aquino', 'Beltran', 'Corpuz'])}`,
        status: 'COMPLETED',
      })
      opCounter++
    }
  }

  const insertedOPs = await chunkedInsertReturning(schema.outgoingPayments, opRows)
  console.log(`  Inserted ${insertedOPs.length} outgoing payments`)

  // ── 10. INSERT 3-WAY MATCHES ──────────────────────────────────────────────

  console.log('Inserting 3-way matches...')

  type MatchGroup = { poId: number; supplierId: number; grIds: number[]; siIds: number[] }
  const matchGroups = new Map<number, MatchGroup>()

  for (const gr of insertedGRs) {
    if (!matchGroups.has(gr.poId)) {
      matchGroups.set(gr.poId, { poId: gr.poId, supplierId: gr.supplierId, grIds: [], siIds: [] })
    }
    matchGroups.get(gr.poId)!.grIds.push(gr.receiptId!)
  }
  for (const si of insertedSIs) {
    if (matchGroups.has(si.poId)) {
      matchGroups.get(si.poId)!.siIds.push(si.supplierInvoiceId!)
    }
  }

  const twmRows: (typeof schema.threeWayMatches.$inferInsert)[] = []

  for (const [, group] of Array.from(matchGroups)) {
    if (group.grIds.length === 0 || group.siIds.length === 0) continue

    const grId = group.grIds[0]
    const siId = group.siIds[0]

    const gr = insertedGRs.find(g => g.receiptId === grId)!
    const si = insertedSIs.find(s => s.supplierInvoiceId === siId)!
    const po = insertedPOs.find(p => p.poId === group.poId)!

    const poAmt = Number(po.totalAmount)
    const grAmt = Number(gr.amount)
    const siAmt = Number(si.amount)

    const matchStatus = pickWeighted(
      ['FULL_MATCH', 'PARTIAL_MATCH', 'MISMATCH'],
      [70, 15, 15]
    )

    let discrepancies: object | null = null
    let aiNotes: string | null = null

    if (matchStatus === 'PARTIAL_MATCH') {
      const diff = siAmt - grAmt
      discrepancies = {
        type: 'AMOUNT_VARIANCE',
        grAmount: grAmt,
        invoiceAmount: siAmt,
        variance: diff.toFixed(2),
        variancePct: ((Math.abs(diff) / grAmt) * 100).toFixed(1),
      }
      aiNotes = `Invoice amount (₱${siAmt.toLocaleString()}) exceeds received amount (₱${grAmt.toLocaleString()}) by ₱${Math.abs(diff).toLocaleString()}. Suggest requesting credit note or splitting payment.`
    } else if (matchStatus === 'MISMATCH') {
      discrepancies = {
        type: 'SIGNIFICANT_VARIANCE',
        poAmount: poAmt,
        grAmount: grAmt,
        invoiceAmount: siAmt * 1.15,
        issues: ['Amount mismatch exceeds tolerance', 'Unit price discrepancy detected'],
      }
      aiNotes = `Significant mismatch detected. Invoice amount exceeds tolerance of 5%. Manual review required before payment approval.`
    }

    twmRows.push({
      poId: group.poId,
      receiptId: grId,
      supplierInvoiceId: siId,
      supplierId: group.supplierId,
      matchStatus,
      poAmount: String(poAmt.toFixed(2)),
      receiptAmount: String(grAmt.toFixed(2)),
      invoiceAmount: String(siAmt.toFixed(2)),
      discrepancies: discrepancies ? JSON.stringify(discrepancies) : null,
      aiNotes,
      reviewedBy: matchStatus !== 'PENDING_REVIEW' ? `${pick(['Ana', 'Jose', 'Maria'])} ${pick(['Reyes', 'Santos', 'Cruz'])}` : null,
      reviewedAt: matchStatus === 'FULL_MATCH' ? addDays(new Date(si.submittedDate!), randInt(1, 5)) : null,
    })
  }

  const insertedTWMs = await chunkedInsertReturning(schema.threeWayMatches, twmRows)
  console.log(`  Inserted ${insertedTWMs.length} 3-way matches`)

  console.log('Stage 2 complete')
}

// ─── Stage 3: ML scores, insight cards, documents, escalations, cash flow forecasts ─

export async function seedStage3() {
  resetSeed(STAGE_SEEDS[3])
  console.log('Stage 3: ML scores + insight cards + documents + escalations + cash flow forecasts')

  // Query customers from DB (inserted in stage 1)
  const allCustomers = await db.select().from(schema.customers)

  // Rebuild payment profiles deterministically (same logic as stage 1, same PRNG state at same point)
  // We re-derive them by re-running the same PRNG sequence used to create them in stage 1.
  // Since we reset the seed to STAGE_SEEDS[3] above, we need the profiles from the DB instead.
  // Use delinquency heuristic: query invoice data to derive risk proxy per customer.
  type InvSummaryRow = { customer_id: number; overdue_count: number; total_count: number }
  const invSummary = await db.execute(sql.raw(`
    SELECT customer_id,
           COUNT(*) FILTER (WHERE status = 'OVERDUE') AS overdue_count,
           COUNT(*) AS total_count
    FROM invoices_col
    GROUP BY customer_id
  `)) as unknown as InvSummaryRow[]

  const invSummaryMap = new Map(invSummary.map(r => [r.customer_id, r]))

  // Derive a rough payment profile (0-4) from invoice data for ML score generation
  function deriveProfile(customerId: number): number {
    const s = invSummaryMap.get(customerId)
    if (!s || s.total_count === 0) return 0
    const overdueRate = s.overdue_count / s.total_count
    if (overdueRate < 0.05) return 0
    if (overdueRate < 0.15) return 1
    if (overdueRate < 0.30) return 2
    if (overdueRate < 0.50) return 3
    return 4
  }

  // ── 11. INSERT ML SCORES ──────────────────────────────────────────────────

  console.log('Inserting ML scores...')

  const segmentNames = ['CHAMPION', 'LOYAL', 'AT_RISK', 'LAPSED', 'PROMISING']
  const payerSegRows = allCustomers.map((c) => {
    const profile = deriveProfile(c.customerId!)
    const segmentIdx = Math.min(profile + randInt(0, 1), segmentNames.length - 1)
    return {
      customerId: c.customerId!,
      segmentName: segmentNames[segmentIdx],
      regularityScore: String((95 - profile * 15 + randInt(-5, 5)).toFixed(2)),
      amountScore: String((90 - profile * 10 + randInt(-5, 5)).toFixed(2)),
      timelinessScore: String((98 - profile * 18 + randInt(-5, 5)).toFixed(2)),
      clusterId: segmentIdx,
    }
  })
  await chunkedInsert(schema.payerSegments, payerSegRows)
  console.log(`  Inserted ${payerSegRows.length} payer segments`)

  const delinqRows = allCustomers.map((c) => {
    const profile = deriveProfile(c.customerId!)
    const baseRisk = [0.02, 0.08, 0.20, 0.45, 0.75][profile]
    const riskScore = Math.min(0.9999, Math.max(0.0001, baseRisk + (rand() - 0.5) * 0.1))
    const riskLevel = riskScore < 0.15 ? 'LOW' : riskScore < 0.40 ? 'MEDIUM' : 'HIGH'
    return {
      customerId: c.customerId!,
      riskScore: String(riskScore.toFixed(4)),
      riskLevel,
      daysOverdueAvg: String((profile * 8 + randInt(0, 15)).toFixed(1)),
      missedPayments: profile * randInt(0, 3),
      paymentTrend: pickWeighted(['IMPROVING', 'STABLE', 'DETERIORATING'], [30, 45, 25]),
      topRiskFactor: pick([
        'Multiple overdue invoices',
        'Seasonal cash flow pattern',
        'Increasing balance trend',
        'Inconsistent payment timing',
        'No overdue history',
        'Strong payment history',
      ]),
    }
  })
  await chunkedInsert(schema.delinquencyScores, delinqRows)
  console.log(`  Inserted ${delinqRows.length} delinquency scores`)

  // Query invoice totals for credit risk calculation
  type InvBalRow = { customer_id: number; outstanding: number; total_billed: number }
  const invBalances = await db.execute(sql.raw(`
    SELECT customer_id,
           SUM(CASE WHEN status != 'PAID' THEN balance_remaining ELSE 0 END) AS outstanding,
           SUM(amount) AS total_billed
    FROM invoices_col
    GROUP BY customer_id
  `)) as unknown as InvBalRow[]
  const invBalMap = new Map(invBalances.map(r => [r.customer_id, r]))

  const creditRiskRows = allCustomers.map((c) => {
    const profile = deriveProfile(c.customerId!)
    const baseRisk = [0.03, 0.10, 0.25, 0.50, 0.80][profile]
    const riskScore = Math.min(0.9999, Math.max(0.0001, baseRisk + (rand() - 0.5) * 0.12))
    const riskLevel = riskScore < 0.20 ? 'LOW' : riskScore < 0.50 ? 'MEDIUM' : 'HIGH'
    const bal = invBalMap.get(c.customerId!) ?? { outstanding: 0, total_billed: 1 }
    const outstanding = Number(bal.outstanding)
    const totalBilled = Number(bal.total_billed)

    return {
      customerId: c.customerId!,
      riskScore: String(riskScore.toFixed(4)),
      riskLevel,
      outstandingBalance: String(outstanding.toFixed(2)),
      creditUtilization: String(Math.min(99.99, (outstanding / Math.max(1, totalBilled) * 100)).toFixed(2)),
      avgDaysOverdue: String((profile * 10 + randInt(0, 20)).toFixed(1)),
      paymentTrend: pickWeighted(['IMPROVING', 'STABLE', 'DETERIORATING'], [25, 50, 25]),
    }
  })
  await chunkedInsert(schema.creditRiskScores, creditRiskRows)
  console.log(`  Inserted ${creditRiskRows.length} credit risk scores`)

  const paymentPatternRows = allCustomers.map((c) => {
    const profile = deriveProfile(c.customerId!)
    return {
      customerId: c.customerId!,
      avgDaysToPay: String((3 + profile * 7 + randInt(-2, 5)).toFixed(1)),
      preferredMethod: pick(PAYMENT_METHODS),
      typicalPaymentDay: randInt(1, 28),
      partialPaymentRate: String((profile * 8 + randInt(0, 10)).toFixed(2)),
    }
  })
  await chunkedInsert(schema.paymentPatterns, paymentPatternRows)
  console.log(`  Inserted ${paymentPatternRows.length} payment patterns`)

  // ── 12. INSERT INSIGHT CARDS ──────────────────────────────────────────────

  console.log('Inserting insight cards...')

  type OverdueRow = { count: number; total: number }
  const overdueAgg = await db.execute(sql.raw(`
    SELECT COUNT(*) AS count, COALESCE(SUM(amount), 0) AS total
    FROM invoices_col WHERE status = 'OVERDUE'
  `)) as unknown as OverdueRow[]
  const overdueCount = Number(overdueAgg[0]?.count ?? 0)
  const totalOverdueAmount = Number(overdueAgg[0]?.total ?? 0)

  type MismatchRow = { count: number; total: number }
  const mismatchAgg = await db.execute(sql.raw(`
    SELECT COUNT(*) AS count, COALESCE(SUM(invoice_amount), 0) AS total
    FROM three_way_matches_col WHERE match_status = 'MISMATCH'
  `)) as unknown as MismatchRow[]
  const mismatchCount = Number(mismatchAgg[0]?.count ?? 0)
  const mismatchTotal = Number(mismatchAgg[0]?.total ?? 0)

  const highRiskCount = delinqRows.filter(d => d.riskLevel === 'HIGH').length

  const insightRows: (typeof schema.insightCards.$inferInsert)[] = [
    {
      severity: 'CRITICAL',
      title: `${overdueCount} Overdue Invoices Totaling ₱${(totalOverdueAmount / 1_000_000).toFixed(1)}M`,
      body: `${overdueCount} invoices are past due with total outstanding of ₱${totalOverdueAmount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}. Immediate collection action required for accounts at risk of contract termination.`,
      action: 'VIEW_OVERDUE_INVOICES',
      relatedEntityType: 'INVOICE',
      relatedParams: JSON.stringify({ status: 'OVERDUE', minAmount: 100000 }),
      isActive: true,
      expiresAt: new Date('2026-04-10'),
    },
    {
      severity: 'HIGH',
      title: '3-Way Match Discrepancies Require Approval',
      body: `${mismatchCount} purchase order invoices have failed 3-way matching. Total value at risk: ₱${(mismatchTotal / 1_000_000).toFixed(1)}M. Review before payment release.`,
      action: 'VIEW_MISMATCHED_POS',
      relatedEntityType: 'PO',
      relatedParams: JSON.stringify({ matchStatus: 'MISMATCH' }),
      isActive: true,
      expiresAt: new Date('2026-04-10'),
    },
    {
      severity: 'MEDIUM',
      title: 'Q1 2026 Cash Flow Inflow Projection',
      body: 'Projected AR inflow for Q1 2026 is ₱142.3M based on current contract portfolio. Payment collection rate target is 94%. Current run rate is tracking at 91.2% — 2.8pp below target.',
      action: 'VIEW_CASHFLOW_FORECAST',
      relatedEntityType: null,
      relatedParams: null,
      isActive: true,
      expiresAt: new Date('2026-03-31'),
    },
    {
      severity: 'HIGH',
      title: 'High Delinquency Risk — 5 Tenants Flagged',
      body: `ML delinquency model has flagged ${highRiskCount} tenant accounts with risk scores above 0.70. Proactive outreach recommended to avoid escalation to legal collections.`,
      action: 'VIEW_HIGH_RISK_CUSTOMERS',
      relatedEntityType: 'CUSTOMER',
      relatedParams: JSON.stringify({ riskLevel: 'HIGH', type: 'TENANT' }),
      isActive: true,
      expiresAt: new Date('2026-04-01'),
    },
    {
      severity: 'LOW',
      title: 'IKEA Manila Bay Lease Renewal Due in 60 Days',
      body: 'The lease agreement for IKEA Philippines at Ayala Malls Manila Bay (Contract ALI-CTR-00020) is due for renewal on May 15, 2026. Monthly contract value: ₱2.25M. Initiate renewal negotiations.',
      action: 'VIEW_CONTRACT',
      relatedEntityType: 'CONTRACT',
      relatedParams: JSON.stringify({ contractNumber: 'ALI-CTR-00020' }),
      isActive: true,
      expiresAt: new Date('2026-05-01'),
    },
  ]

  await db.insert(schema.insightCards).values(insightRows)
  console.log(`  Inserted ${insightRows.length} insight cards`)

  // ── 13. INSERT SAMPLE DOCUMENTS ──────────────────────────────────────────

  console.log('Inserting sample documents...')

  type PaidInvDocRow = { invoice_id: number; customer_id: number; payment_id: number | null }
  const paidInvDocs = await db.execute(sql.raw(`
    SELECT i.invoice_id, i.customer_id, p.payment_id
    FROM invoices_col i
    LEFT JOIN incoming_payments_col p ON p.invoice_id = i.invoice_id AND p.status = 'CONFIRMED'
    WHERE i.status = 'PAID'
    ORDER BY i.invoice_id
    LIMIT 3
  `)) as unknown as PaidInvDocRow[]

  type CustRow = { customer_id: number }
  const cust12 = await db.execute(sql.raw(`SELECT customer_id FROM customers_col ORDER BY customer_id LIMIT 1 OFFSET 12`)) as unknown as CustRow[]
  const cust2 = await db.execute(sql.raw(`SELECT customer_id FROM customers_col ORDER BY customer_id LIMIT 1 OFFSET 2`)) as unknown as CustRow[]

  type OverdueInvRow = { invoice_id: number }
  const overdueForCust12 = await db.execute(sql.raw(`
    SELECT invoice_id FROM invoices_col
    WHERE customer_id = ${cust12[0]?.customer_id ?? 0} AND status = 'OVERDUE'
    LIMIT 1
  `)) as unknown as OverdueInvRow[]

  // Generate base64 SVG deposit slip images for realistic rendering
  function makeDepositSlipSvg(opts: { bank: string; date: string; depositor: string; amount: string; refNo: string; accountName: string; accountNo: string }): string {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400" viewBox="0 0 600 400"><rect width="600" height="400" fill="#f5f5e8" rx="8"/><text x="300" y="35" text-anchor="middle" font-family="serif" font-size="18" font-weight="bold" fill="#1a3a6b">${opts.bank}</text><text x="300" y="55" text-anchor="middle" font-family="sans-serif" font-size="10" fill="#666">Makati Main Branch</text><line x1="40" y1="70" x2="560" y2="70" stroke="#ccc"/><text x="50" y="100" font-family="sans-serif" font-size="12" fill="#888">Date:</text><text x="200" y="100" font-family="sans-serif" font-size="12" font-weight="bold" fill="#333">${opts.date}</text><text x="50" y="130" font-family="sans-serif" font-size="12" fill="#888">Account Name:</text><text x="200" y="130" font-family="sans-serif" font-size="12" font-weight="bold" fill="#333">${opts.accountName}</text><text x="50" y="160" font-family="sans-serif" font-size="12" fill="#888">Account No:</text><text x="200" y="160" font-family="sans-serif" font-size="12" font-weight="bold" fill="#333">${opts.accountNo}</text><text x="50" y="200" font-family="sans-serif" font-size="12" fill="#888">Depositor:</text><text x="200" y="200" font-family="sans-serif" font-size="12" font-weight="bold" fill="#333">${opts.depositor}</text><rect x="40" y="220" width="520" height="50" rx="4" fill="#e8f5e9" stroke="#4caf50" stroke-width="1"/><text x="50" y="250" font-family="sans-serif" font-size="12" fill="#888">Amount:</text><text x="200" y="252" font-family="sans-serif" font-size="20" font-weight="bold" fill="#1b5e20">PHP ${opts.amount}</text><text x="50" y="300" font-family="sans-serif" font-size="12" fill="#888">Reference No:</text><text x="200" y="300" font-family="sans-serif" font-size="12" font-weight="bold" fill="#333">${opts.refNo}</text><line x1="40" y1="330" x2="560" y2="330" stroke="#ccc"/><text x="300" y="355" text-anchor="middle" font-family="sans-serif" font-size="9" fill="#999">— Machine Validated —</text></svg>`
    return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`
  }

  const docRows: (typeof schema.documents.$inferInsert)[] = [
    {
      customerId: paidInvDocs[0]?.customer_id ?? allCustomers[0].customerId!,
      invoiceId: paidInvDocs[0]?.invoice_id,
      paymentId: paidInvDocs[0]?.payment_id ?? null,
      fileUrl: makeDepositSlipSvg({ bank: 'BANK OF THE PHILIPPINE ISLANDS', date: 'November 14, 2025', depositor: 'Uniqlo Philippines Inc.', amount: '1,134,791.00', refNo: 'BPI-20251114-7842', accountName: 'Ayala Land Corporation', accountNo: '1234-5678-90' }),
      fileName: 'deposit_slip_nov2025.svg',
      fileType: 'image/svg+xml',
      ocrResult: {
        payment_amount: 1134791.00,
        payment_date: '2025-11-14',
        reference_number: 'BPI-20251114-7842',
        bank_name: 'Bank of the Philippine Islands',
        payee_name: 'Ayala Land Corporation',
        payer_name: 'Uniqlo Philippines Inc.',
        document_type: 'deposit_slip',
      },
      ocrStatus: 'COMPLETED',
      validationResult: {
        is_valid: true,
        checks: [
          { check: 'AMOUNT_MATCH', passed: true, expected: '1,134,791.00', actual: '1,134,791.00', severity: 'critical' },
          { check: 'PAYER_MATCH', passed: true, expected: 'Uniqlo Philippines Inc.', actual: 'Uniqlo Philippines Inc.', severity: 'critical' },
          { check: 'DATE_CHECK', passed: true, expected: '2025-11-14', actual: '2025-11-14', severity: 'warning' },
          { check: 'DUPLICATE_CHECK', passed: true, expected: 'No duplicate', actual: 'No duplicate', severity: 'critical' },
        ],
      },
    },
    {
      customerId: paidInvDocs[1]?.customer_id ?? allCustomers[1].customerId!,
      invoiceId: paidInvDocs[1]?.invoice_id,
      paymentId: paidInvDocs[1]?.payment_id ?? null,
      fileUrl: makeDepositSlipSvg({ bank: 'BANK OF THE PHILIPPINE ISLANDS', date: 'December 12, 2025', depositor: 'Juan Santos', amount: '940,433.00', refNo: 'BPI-20251212-3391', accountName: 'Ayala Land Corporation', accountNo: '1234-5678-90' }),
      fileName: 'deposit_slip_dec2025.svg',
      fileType: 'image/svg+xml',
      ocrResult: {
        payment_amount: 940433.00,
        payment_date: '2025-12-12',
        reference_number: 'BPI-20251212-3391',
        bank_name: 'Bank of the Philippine Islands',
        payee_name: 'Ayala Land Corporation',
        payer_name: 'Juan Santos',
        document_type: 'deposit_slip',
      },
      ocrStatus: 'COMPLETED',
      validationResult: {
        is_valid: false,
        checks: [
          { check: 'AMOUNT_MATCH', passed: false, expected: '1,134,791.00', actual: '940,433.00', severity: 'critical' },
          { check: 'PAYER_MATCH', passed: false, expected: 'Uniqlo Philippines Inc.', actual: 'Juan Santos', severity: 'critical' },
          { check: 'DATE_CHECK', passed: true, expected: '2025-12-12', actual: '2025-12-12', severity: 'warning' },
          { check: 'DUPLICATE_CHECK', passed: true, expected: 'No duplicate', actual: 'No duplicate', severity: 'critical' },
        ],
      },
    },
    {
      customerId: cust12[0]?.customer_id ?? cust2[0]?.customer_id ?? allCustomers[2].customerId!,
      invoiceId: overdueForCust12[0]?.invoice_id ?? null,
      paymentId: null,
      fileUrl: makeDepositSlipSvg({ bank: 'METROBANK', date: 'February 3, 2026', depositor: 'JP Morgan Chase Bank N.A.', amount: '518,688.30', refNo: 'MBK-20260203-0091', accountName: 'Ayala Land Corporation', accountNo: '987-654-321' }),
      fileName: 'deposit_slip_feb2026.svg',
      fileType: 'image/svg+xml',
      ocrResult: {
        payment_amount: 518688.30,
        payment_date: '2026-02-03',
        reference_number: 'MBK-20260203-0091',
        bank_name: 'Metrobank',
        payee_name: 'Ayala Land Corporation',
        payer_name: 'JP Morgan Chase Bank N.A.',
        document_type: 'deposit_slip',
      },
      ocrStatus: 'COMPLETED',
      validationResult: {
        is_valid: false,
        checks: [
          { check: 'AMOUNT_MATCH', passed: true, expected: '518,688.30', actual: '518,688.30', severity: 'critical' },
          { check: 'PAYER_MATCH', passed: true, expected: 'JP Morgan Chase Bank N.A.', actual: 'JP Morgan Chase Bank N.A.', severity: 'critical' },
          { check: 'DATE_CHECK', passed: true, expected: '2026-02-03', actual: '2026-02-03', severity: 'warning' },
          { check: 'DUPLICATE_CHECK', passed: false, expected: 'No duplicate', actual: 'Reference MBK-20260203-0091 already exists', severity: 'critical' },
        ],
      },
    },
  ]

  const insertedDocs = await db.insert(schema.documents).values(docRows).returning()
  console.log(`  Inserted ${insertedDocs.length} documents`)

  // ── 14. INSERT ESCALATIONS ────────────────────────────────────────────────

  console.log('Inserting escalations...')

  const escalationRows: (typeof schema.escalations.$inferInsert)[] = [
    {
      documentId: insertedDocs[2]!.documentId!,
      customerId: insertedDocs[2]!.customerId,
      invoiceId: insertedDocs[2]!.invoiceId ?? null,
      type: 'INVOICE_DISPUTE',
      description: 'JP Morgan Chase disputes service charge line items on January 2026 invoice. Tenant claims facility management charges were not disclosed in lease agreement.',
      aiAnalysis: JSON.stringify({
        sentimentScore: -0.72,
        urgencyLevel: 'HIGH',
        suggestedAction: 'Legal review of lease terms. Schedule meeting with tenant within 5 business days.',
        similarCases: 2,
        estimatedResolutionDays: 14,
      }),
      status: 'IN_PROGRESS',
      assignedTo: 'Maria Santos — Legal & Compliance',
      resolutionNotes: null,
      resolvedAt: null,
    },
    {
      documentId: insertedDocs[0]!.documentId!,
      customerId: insertedDocs[0]!.customerId,
      invoiceId: insertedDocs[0]!.invoiceId ?? null,
      type: 'PAYMENT_VERIFICATION',
      description: 'Payment receipt submitted for Oct 2025 invoice but bank confirmation pending. Amount matches but transfer reference not yet reconciled in system.',
      aiAnalysis: JSON.stringify({
        sentimentScore: 0.15,
        urgencyLevel: 'MEDIUM',
        suggestedAction: 'Request bank confirmation statement from tenant. Cross-reference with treasury records.',
        similarCases: 8,
        estimatedResolutionDays: 3,
      }),
      status: 'RESOLVED',
      assignedTo: 'Jose Reyes — Collections Team',
      resolutionNotes: 'Bank confirmation received. Payment verified and reconciled. Invoice marked as PAID.',
      resolvedAt: new Date('2025-11-20'),
    },
    {
      documentId: insertedDocs[1]!.documentId!,
      customerId: insertedDocs[1]!.customerId,
      invoiceId: insertedDocs[1]!.invoiceId ?? null,
      type: 'DOCUMENT_MISMATCH',
      description: 'OCR extracted amount of ₱2,250,000 from bank transfer confirmation but invoice amount is ₱2,200,000. Possible decimal or formatting error in source document.',
      aiAnalysis: JSON.stringify({
        sentimentScore: 0.05,
        urgencyLevel: 'LOW',
        suggestedAction: 'Request original transfer document from IKEA finance team. Likely rounding difference.',
        ocrConfidence: 0.94,
        detectedDiscrepancy: { extractedAmount: 2250000, invoiceAmount: 2200000 },
        estimatedResolutionDays: 2,
      }),
      status: 'OPEN',
      assignedTo: 'Ana Cruz — Document Verification',
      resolutionNotes: null,
      resolvedAt: null,
    },
  ]

  await db.insert(schema.escalations).values(escalationRows)
  console.log(`  Inserted ${escalationRows.length} escalations`)

  // ── 15. INSERT CASH FLOW FORECASTS ────────────────────────────────────────

  console.log('Inserting cash flow forecasts...')
  const cfRows: (typeof schema.cashFlowForecasts.$inferInsert)[] = []

  const forecastMonths = [
    { year: 2026, month: 4 },
    { year: 2026, month: 5 },
    { year: 2026, month: 6 },
    { year: 2026, month: 7 },
    { year: 2026, month: 8 },
    { year: 2026, month: 9 },
  ]

  const inflowTrend = [18_500_000, 19_200_000, 19_800_000, 20_100_000, 20_800_000, 21_500_000]
  const outflowTrend = [13_200_000, 13_800_000, 13_500_000, 14_100_000, 14_600_000, 14_300_000]

  for (let fi = 0; fi < forecastMonths.length; fi++) {
    const { year, month } = forecastMonths[fi]
    const baseInflow = inflowTrend[fi] + randInt(-800_000, 800_000)
    const baseOutflow = outflowTrend[fi] + randInt(-500_000, 500_000)
    const uncertainty = 0.05 + fi * 0.03

    cfRows.push({
      forecastDate: fmtDate(startOfMonth(year, month)),
      predictedInflow: String(baseInflow.toFixed(2)),
      predictedOutflow: String(baseOutflow.toFixed(2)),
      confidenceLower: String((baseInflow * (1 - uncertainty)).toFixed(2)),
      confidenceUpper: String((baseInflow * (1 + uncertainty)).toFixed(2)),
      basedOnPeriod: 'Oct 2025 – Mar 2026',
    })
  }

  await db.insert(schema.cashFlowForecasts).values(cfRows)
  console.log(`  Inserted ${cfRows.length} cash flow forecasts`)

  console.log('Stage 3 complete')
}

// ─── Stage 4: Penalty config, penalty ledger, payment allocations, AP workflow events ─

export async function seedStage4() {
  resetSeed(STAGE_SEEDS[4])
  console.log('Stage 4: penalties + payment allocations + AP workflow events')

  // ── 16. Penalty Config ────────────────────────────────────────────────────

  console.log('Seeding penalty config...')
  await db.insert(penaltyConfig).values({
    penaltyRatePercent: '2.0',
    penaltyFrequency: 'MONTHLY',
    applicationMethod: 'PENALTIES_FIRST',
    gracePeriodDays: 0,
  })
  console.log('  Penalty config seeded')

  // ── 17. Penalty Ledger ────────────────────────────────────────────────────

  console.log('Seeding penalty ledger entries...')
  const overdueInvs = await db.select().from(invoices)
    .where(sql`${invoices.status} IN ('OVERDUE', 'PARTIAL') AND ${invoices.dueDate} < CURRENT_DATE`)

  const penaltyRate = 2.0
  let penaltyCount = 0
  const penaltyBatch: { invoiceId: number; periodLabel: string; penaltyAmount: string; penaltyRate: string; accrualDate: string; status: string; paidAmount: string }[] = []
  const invoicePenaltyTotals: { invoiceId: number; total: number }[] = []

  for (const inv of overdueInvs) {
    const dueDate = new Date(inv.dueDate)
    const now = new Date('2026-03-19')
    const monthsOverdue = Math.max(1, Math.ceil((now.getTime() - dueDate.getTime()) / (30 * 24 * 60 * 60 * 1000)))
    const principal = Number(inv.amount)
    let totalPen = 0

    for (let m = 1; m <= monthsOverdue; m++) {
      const penAmt = Math.round(principal * (penaltyRate / 100) * 100) / 100
      const accrualDate = addMonths(dueDate, m)
      penaltyBatch.push({
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

    invoicePenaltyTotals.push({ invoiceId: inv.invoiceId, total: totalPen })
  }

  for (let i = 0; i < penaltyBatch.length; i += 50) {
    const chunk = penaltyBatch.slice(i, i + 50)
    await db.insert(penaltyLedger).values(chunk)
  }

  if (invoicePenaltyTotals.length > 0) {
    const cases = invoicePenaltyTotals.map(({ invoiceId, total }) =>
      `WHEN ${invoiceId} THEN ${total}`
    ).join(' ')
    const ids = invoicePenaltyTotals.map(({ invoiceId }) => invoiceId).join(',')
    await db.execute(sql.raw(
      `UPDATE invoices_col SET total_penalties = CASE invoice_id ${cases} END, penalties_paid = 0 WHERE invoice_id IN (${ids})`
    ))
  }
  console.log(`  ${penaltyCount} penalty ledger entries seeded`)

  // ── 18. Payment Allocations ───────────────────────────────────────────────

  console.log('Seeding payment allocations...')
  const confirmedPayments = await db.select().from(incomingPayments)
    .where(eq(incomingPayments.status, 'CONFIRMED'))

  const allocBatch: { paymentId: number; invoiceId: number; allocationType: string; amount: string }[] = []
  for (const pay of confirmedPayments) {
    if (pay.invoiceId) {
      allocBatch.push({
        paymentId: pay.paymentId,
        invoiceId: pay.invoiceId,
        allocationType: 'PRINCIPAL',
        amount: pay.amount,
      })
    }
  }
  for (let i = 0; i < allocBatch.length; i += 50) {
    const chunk = allocBatch.slice(i, i + 50)
    await db.insert(paymentAllocations).values(chunk)
  }
  console.log(`  ${allocBatch.length} payment allocations seeded`)

  // ── 19. AP Workflow Events ────────────────────────────────────────────────

  console.log('Seeding AP workflow events...')
  const allSupplierInvoices = await db.select({
    si: supplierInvoices,
    po: purchaseOrders,
    sup: suppliers,
  }).from(supplierInvoices)
    .leftJoin(purchaseOrders, eq(supplierInvoices.poId, purchaseOrders.poId))
    .leftJoin(suppliers, eq(supplierInvoices.supplierId, suppliers.supplierId))

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
  const eventBatch: { supplierInvoiceId: number; poId: number; eventType: string; eventData: Record<string, unknown>; performedBy: string; createdAt: Date }[] = []
  const statusUpdates: { id: number; status: string }[] = []

  for (let i = 0; i < allSupplierInvoices.length; i++) {
    const { si, po, sup } = allSupplierInvoices[i]
    if (!po || !sup) continue

    let stepsCompleted: number
    if (si.paymentStatus === 'PAID') {
      stepsCompleted = 8
    } else if (si.paymentStatus === 'PARTIAL') {
      stepsCompleted = 6
    } else {
      stepsCompleted = pick([2, 3, 4, 5])
    }

    const finalStatus = WORKFLOW_STEPS[stepsCompleted - 1].status
    statusUpdates.push({ id: si.supplierInvoiceId, status: finalStatus })

    const baseDate = new Date(si.submittedDate)
    for (let s = 0; s < stepsCompleted; s++) {
      const step = WORKFLOW_STEPS[s]
      const eventDate = addDays(baseDate, s * 2 + randInt(0, 1))
      eventBatch.push({
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

  if (statusUpdates.length > 0) {
    const cases = statusUpdates.map(({ id, status }) =>
      `WHEN ${id} THEN '${status}'`
    ).join(' ')
    const ids = statusUpdates.map(({ id }) => id).join(',')
    await db.execute(sql.raw(
      `UPDATE supplier_invoices_col SET workflow_status = CASE supplier_invoice_id ${cases} END WHERE supplier_invoice_id IN (${ids})`
    ))
  }

  for (let i = 0; i < eventBatch.length; i += 50) {
    const chunk = eventBatch.slice(i, i + 50)
    await db.insert(apWorkflowEvents).values(chunk)
  }
  console.log(`  ${eventCount} AP workflow events seeded`)

  console.log('Stage 4 complete')
}

// ─── Stage 5: Security deposits, forfeitures, credit ledger, milestone templates, PO milestones, check payments ─

export async function seedStage5() {
  resetSeed(STAGE_SEEDS[5])
  console.log('Stage 5: deposits + forfeitures + credit ledger + milestones + check payments')

  // ── 20. Security Deposits ─────────────────────────────────────────────────

  console.log('Seeding security deposits for LEASE contracts...')
  type LeaseRow = { customer_id: number; contract_id: number; monthly_amount: string }
  const leaseRows = await db.execute(sql.raw('SELECT c.customer_id, c.contract_id, c.monthly_amount FROM contracts_col c WHERE c.type = \'LEASE\'')) as unknown as LeaseRow[]

  const depositInserts = leaseRows.map((row) => ({
    customerId: row.customer_id,
    contractId: row.contract_id,
    initialAmount: String((Number(row.monthly_amount) * 3).toFixed(2)),
    currentBalance: String((Number(row.monthly_amount) * 3).toFixed(2)),
  }))

  let insertedDeposits: (typeof securityDeposits.$inferSelect)[] = []
  if (depositInserts.length > 0) {
    insertedDeposits = await db.insert(securityDeposits).values(depositInserts).returning()
  }
  console.log(`  ${insertedDeposits.length} security deposits seeded`)

  // ── 21. Deposit Forfeitures ───────────────────────────────────────────────

  console.log('Seeding deposit forfeitures...')
  type ForfeitCandidate = { invoice_id: number; customer_id: number; amount: string; due_date: string; deposit_id: number; current_balance: string; days_overdue: number }
  const forfeitCandidates = await db.execute(sql.raw(`SELECT i.invoice_id, i.customer_id, i.amount, i.due_date, sd.deposit_id, sd.current_balance, EXTRACT(DAY FROM NOW() - i.due_date::date)::int as days_overdue FROM invoices_col i INNER JOIN security_deposits_col sd ON sd.customer_id = i.customer_id WHERE i.status IN ('OVERDUE', 'PARTIAL') AND i.due_date < CURRENT_DATE - INTERVAL '90 days' AND sd.current_balance > 0 ORDER BY i.due_date ASC LIMIT 10`)) as unknown as ForfeitCandidate[]

  const forfeitInserts: (typeof depositForfeitures.$inferInsert)[] = []
  const invoiceFlagUpdates: { id: number; flag: string }[] = []
  const depositBalUpdates: { id: number; newBalance: number }[] = []

  if (forfeitCandidates.length >= 2) {
    const s1 = forfeitCandidates[0]
    const amt1 = Math.min(Number(s1.amount) * 0.5, Number(s1.current_balance))
    forfeitInserts.push({ depositId: s1.deposit_id, customerId: s1.customer_id, invoiceId: s1.invoice_id, amount: String(amt1.toFixed(2)), status: 'APPROVED', reviewedBy: 'admin@ayalaland.com', reviewedAt: new Date('2026-03-01'), notes: 'Approved — 150+ days overdue' })
    invoiceFlagUpdates.push({ id: s1.invoice_id, flag: 'FORFEITED' })
    depositBalUpdates.push({ id: s1.deposit_id, newBalance: Number(s1.current_balance) - amt1 })

    const s2 = forfeitCandidates.find(c => c.invoice_id !== s1.invoice_id) || forfeitCandidates[1]
    const dep2 = insertedDeposits.find(d => d.customerId === s2.customer_id)
    if (dep2) {
      forfeitInserts.push({ depositId: dep2.depositId!, customerId: s2.customer_id, invoiceId: s2.invoice_id, amount: String((Number(s2.amount) * 0.3).toFixed(2)), status: 'FLAGGED', notes: 'Auto-flagged — 90+ days overdue' })
      invoiceFlagUpdates.push({ id: s2.invoice_id, flag: 'FLAGGED' })
    }

    const s4 = forfeitCandidates.find(c => c.customer_id !== s1.customer_id && c.customer_id !== s2.customer_id)
    if (s4) {
      forfeitInserts.push({ depositId: s4.deposit_id, customerId: s4.customer_id, invoiceId: s4.invoice_id, amount: s4.current_balance, status: 'APPROVED', reviewedBy: 'admin@ayalaland.com', reviewedAt: new Date('2026-03-10'), notes: 'Full deposit exhaustion' })
      invoiceFlagUpdates.push({ id: s4.invoice_id, flag: 'FORFEITED' })
      depositBalUpdates.push({ id: s4.deposit_id, newBalance: 0 })
    }
  }

  if (forfeitInserts.length > 0) await db.insert(depositForfeitures).values(forfeitInserts)
  if (invoiceFlagUpdates.length > 0) {
    const cases = invoiceFlagUpdates.map(u => `WHEN ${u.id} THEN '${u.flag}'`).join(' ')
    const ids = invoiceFlagUpdates.map(u => u.id).join(',')
    await db.execute(sql.raw(`UPDATE invoices_col SET deposit_forfeiture_flag = CASE invoice_id ${cases} END WHERE invoice_id IN (${ids})`))
  }
  if (depositBalUpdates.length > 0) {
    const cases = depositBalUpdates.map(u => `WHEN ${u.id} THEN ${u.newBalance.toFixed(2)}`).join(' ')
    const ids = depositBalUpdates.map(u => u.id).join(',')
    await db.execute(sql.raw(`UPDATE security_deposits_col SET current_balance = CASE deposit_id ${cases} END WHERE deposit_id IN (${ids})`))
  }
  console.log(`  ${forfeitInserts.length} deposit forfeitures seeded`)

  // ── 22. Credit Ledger ─────────────────────────────────────────────────────

  console.log('Seeding credit ledger entries...')

  type PaidInvRow = { customer_id: number; invoice_id: number }
  const paidInvRows = await db.execute(sql.raw('SELECT DISTINCT customer_id, invoice_id FROM invoices_col WHERE status = \'PAID\' LIMIT 2')) as unknown as PaidInvRow[]

  const creditInserts = paidInvRows.map(row => {
    const creditAmt = randInt(3000, 8000)
    return { customerId: row.customer_id, type: 'CREDIT' as const, amount: String(creditAmt.toFixed(2)), description: 'Overpayment credit applied from prior invoice', invoiceId: row.invoice_id, _amt: creditAmt }
  })
  if (creditInserts.length > 0) {
    await db.insert(creditLedger).values(creditInserts.map(({ _amt, ...rest }) => rest))
    const cases = creditInserts.map(c => `WHEN ${c.customerId} THEN credit_balance + ${c._amt}`).join(' ')
    const ids = creditInserts.map(c => c.customerId).join(',')
    await db.execute(sql.raw(`UPDATE customers_col SET credit_balance = CASE customer_id ${cases} END WHERE customer_id IN (${ids})`))
  }
  console.log(`  ${creditInserts.length} credit ledger entries seeded`)

  // ── 23. Milestone Templates ───────────────────────────────────────────────

  console.log('Seeding milestone templates...')
  const insertedTemplates = await db.insert(milestoneTemplates).values([
    {
      name: 'Standard 20/40/40',
      milestones: JSON.stringify([
        { label: 'Mobilization', percentage: 20 },
        { label: 'Mid-Delivery', percentage: 40 },
        { label: 'Final Acceptance', percentage: 40 },
      ]),
    },
    {
      name: 'Equal Split 50/50',
      milestones: JSON.stringify([
        { label: 'Initial Delivery', percentage: 50 },
        { label: 'Completion', percentage: 50 },
      ]),
    },
    {
      name: 'Full on Completion',
      milestones: JSON.stringify([
        { label: 'Full Delivery', percentage: 100 },
      ]),
    },
  ]).returning()
  console.log(`  ${insertedTemplates.length} milestone templates seeded`)

  // ── 24. PO Milestones ─────────────────────────────────────────────────────

  console.log('Seeding PO milestones...')
  type PORow = { po_id: number; status: string; total_amount: string }
  const allPORows = await db.execute(sql.raw('SELECT po_id, status, total_amount FROM purchase_orders_col')) as unknown as PORow[]

  const standardTemplate = insertedTemplates[0]
  const standardMilestones = JSON.parse(standardTemplate.milestones as string) as { label: string; percentage: number }[]
  const poMilestoneRows: (typeof poMilestones.$inferInsert)[] = []

  for (const po of allPORows) {
    if (rand() > 0.7) {
      const poTotal = Number(po.total_amount)
      const poNow = new Date('2026-03-10')

      standardMilestones.forEach((m, idx) => {
        const milestoneAmt = poTotal * (m.percentage / 100)
        let status: string
        let completedAt: Date | null = null
        let paidAt: Date | null = null

        if (po.status === 'CLOSED') {
          status = 'PAID'
          completedAt = addDays(poNow, -(randInt(10, 30) + idx * 10))
          paidAt = addDays(completedAt, randInt(3, 7))
        } else if (po.status === 'RECEIVED') {
          if (idx === 0) {
            status = 'PAID'
            completedAt = addDays(poNow, -20)
            paidAt = addDays(completedAt, 5)
          } else if (idx === 1) {
            status = 'COMPLETED'
            completedAt = addDays(poNow, -5)
          } else {
            status = 'PENDING'
          }
        } else {
          status = 'PENDING'
        }

        poMilestoneRows.push({
          poId: po.po_id,
          label: m.label,
          percentage: String(m.percentage.toFixed(2)),
          amount: String(milestoneAmt.toFixed(2)),
          status,
          completedAt,
          paidAt,
          paymentReference: paidAt ? `MIL-REF-${po.po_id}-${idx + 1}` : null,
          sortOrder: idx,
        })
      })
    }
  }

  let milestoneCount = 0
  for (let i = 0; i < poMilestoneRows.length; i += 50) {
    const chunk = poMilestoneRows.slice(i, i + 50)
    await db.insert(poMilestones).values(chunk)
    milestoneCount += chunk.length
  }
  console.log(`  ${milestoneCount} PO milestones seeded`)

  // ── 25. Check Payments ────────────────────────────────────────────────────

  console.log('Seeding check payment entries...')
  type CheckInvoiceRow = { invoice_id: number; customer_id: number; amount: string }
  const checkInvRows = await db.execute(sql.raw('SELECT invoice_id, customer_id, amount FROM invoices_col WHERE status = \'PAID\' LIMIT 4')) as unknown as CheckInvoiceRow[]

  const now = new Date('2026-03-25')
  const checkPaymentData = [
    { daysAgo: 1, status: 'PENDING_CLEARANCE', checkNum: 'CHK-1001', clearance: null as Date | null },
    { daysAgo: 2, status: 'PENDING_CLEARANCE', checkNum: 'CHK-1002', clearance: null as Date | null },
    { daysAgo: 5, status: 'CONFIRMED',          checkNum: 'CHK-1003', clearance: addDays(now, -3) },
    { daysAgo: 7, status: 'BOUNCED',            checkNum: 'CHK-1004', clearance: null as Date | null },
  ]

  const checkPaymentRows: (typeof incomingPayments.$inferInsert)[] = []
  for (let i = 0; i < Math.min(checkInvRows.length, checkPaymentData.length); i++) {
    const inv = checkInvRows[i]
    const meta = checkPaymentData[i]
    const payDate = addDays(now, -meta.daysAgo)
    checkPaymentRows.push({
      invoiceId: inv.invoice_id,
      customerId: inv.customer_id,
      amount: inv.amount,
      paymentMethod: 'CHECK',
      paymentDate: payDate,
      referenceNumber: `CHK-REF-${String(i + 1).padStart(6, '0')}`,
      status: meta.status,
      confirmedAt: meta.status === 'CONFIRMED' ? meta.clearance : null,
      checkNumber: meta.checkNum,
      clearanceDate: meta.clearance ? fmtDate(meta.clearance) : null,
    })
  }

  let insertedCheckPayments: (typeof incomingPayments.$inferSelect)[] = []
  if (checkPaymentRows.length > 0) {
    insertedCheckPayments = await db.insert(incomingPayments).values(checkPaymentRows).returning()
  }
  console.log(`  ${insertedCheckPayments.length} check payments seeded`)

  console.log('Stage 5 complete')
}

// ─── Main (backwards compat) ──────────────────────────────────────────────────

// ─── CWT Enrollment (exported so it can be run standalone after other stages) ──

export async function seedCwt() {
  const allCustomers = await db.select().from(schema.customers)
  const corpTenants = allCustomers.filter(c => c.type === 'TENANT').slice(0, 11)

  const SIGNATORIES = ['Juan Dela Cruz','Maria Santos','Jose Reyes','Ana Garcia',
                       'Roberto Tan','Lucia Lim','Eduardo Cruz','Isabella Reyes']

  const enrolledIds: number[] = []
  for (let i = 0; i < 8; i++) {
    const c = corpTenants[i]
    if (!c) break
    const tin = `${randInt(100, 999)}-${randInt(100, 999)}-${randInt(100, 999)}-000`
    await db.update(schema.customers).set({
      tin,
      branchCode: '000',
      rdoCode: String(randInt(40, 60)),
      taxClassification: 'PRIVATE',
      isTopWithholdingAgent: i === 0,
      authorizedSignatoryName: SIGNATORIES[i],
      authorizedSignatoryEmail: `signatory${i + 1}@${c.name.toLowerCase().replace(/\s+/g,'').replace(/[^a-z0-9]/g,'')}.com.ph`,
      signatureImageUrl: `/signatures/demo-sig-${i + 1}.png`,
      withholdingRatePct: '5.00',
      cwtAtcCode: 'WC100',
      cwtAutoIssueEnrolledAt: new Date(Date.now() - randInt(30, 180) * 86400000),
    }).where(eq(schema.customers.customerId, c.customerId))
    enrolledIds.push(c.customerId)
  }

  // Mark tenant #8 as the "reserved magic-moment tenant" with a recognizable name suffix.
  if (corpTenants[7]) {
    const name = corpTenants[7].name
    if (!name.includes('(Demo Corp)')) {
      await db.update(schema.customers).set({ name: name + ' (Demo Corp)' })
        .where(eq(schema.customers.customerId, corpTenants[7].customerId))
    }
  }

  console.log(`Enrolled ${enrolledIds.length} corporate tenants for CWT auto-issuance`)

  // Seed historical CWT certificates for enrolled tenants #0..6 (skip reserved #7)
  const cwtRows: any[] = []
  for (const customerId of enrolledIds.slice(0, 7)) {
    const tenantInvoices = await db.select().from(schema.invoices)
      .where(eq(schema.invoices.customerId, customerId)).limit(3)
    for (const inv of tenantInvoices) {
      const gross = Number(inv.amount)
      const withheld = Math.round(gross * 5) / 100
      const payment = (await db.select().from(schema.incomingPayments)
        .where(eq(schema.incomingPayments.invoiceId, inv.invoiceId)).limit(1))[0]
      if (!payment) continue
      const period = new Date(inv.billingPeriodStart)
      const ref = referenceNumberFor({
        year: period.getFullYear(), month: period.getMonth() + 1,
        customerId, invoiceId: inv.invoiceId, paymentId: payment.paymentId,
      })
      cwtRows.push({
        customerId, contractId: inv.contractId, invoiceId: inv.invoiceId, paymentId: payment.paymentId,
        grossAmount: gross.toFixed(2), withheldAmount: withheld.toFixed(2),
        ratePct: '5.00', atcCode: 'WC100',
        periodStart: inv.billingPeriodStart, periodEnd: inv.billingPeriodEnd,
        referenceNumber: ref,
        pdfUrl: null,
        signatureApplied: true, status: 'ISSUED', source: 'AUTO_ENROLLED',
        signedByName: 'Auto', signedByEmail: 'auto@ayalaland.com',
        issuedAt: (() => {
          const d = payment.paymentDate
          if (!d) return null
          if (d instanceof Date && !isNaN(d.getTime())) return d
          // Proxy may return ISO string; Drizzle appends +0000 making it invalid — strip Z suffix
          const s = String(d).replace(/Z\+0000$/, 'Z').replace(/\+0000$/, '+00:00')
          const parsed = new Date(s)
          return isNaN(parsed.getTime()) ? null : parsed
        })(),
      })
    }
  }
  if (cwtRows.length > 0) {
    const inserted = await chunkedInsertReturning(schema.cwtCertificates, cwtRows)
    // Each seeded cert gets a single line — the historical real-property rent line.
    const lineRows = inserted.map((c: any) => ({
      certificateId: c.certificateId,
      lineIndex: 1,
      description: 'Rentals of Real Property',
      atcCode: c.atcCode,
      ratePct: c.ratePct,
      grossAmount: c.grossAmount,
      withheldAmount: c.withheldAmount,
    }))
    if (lineRows.length > 0) {
      await chunkedInsert(schema.cwtCertificateLines, lineRows)
    }
    console.log(`Seeded ${cwtRows.length} historical CWT certificates (${lineRows.length} lines)`)
  } else {
    console.log('Seeded 0 historical CWT certificates')
  }
}

export async function seedDatabase() {
  console.log('Starting Ayala Land Payments Portal seed...\n')
  await seedStage1()
  await seedStage2()
  await seedStage3()
  await seedStage4()
  await seedStage5()
  // ─── CWT ENROLLMENT LAYER ────────────────────────────────────────────────
  await seedCwt()
  console.log('\nSeed complete!')
}
