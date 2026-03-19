import { db } from '@/db'
import { sql, eq } from 'drizzle-orm'
import * as schema from '@/db/schema'
import {
  penaltyConfig, penaltyLedger, paymentAllocations, apWorkflowEvents,
} from '@/db/schema'

// Aliases for tables used in new seed steps (the rest use `schema.*`)
const { invoices, incomingPayments, supplierInvoices, purchaseOrders, suppliers } = schema

// ─── Seeded PRNG (Mulberry32) ─────────────────────────────────────────────────

let _seed = 42
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

// ─── Main ─────────────────────────────────────────────────────────────────────

export async function seedDatabase() {
  console.log('🌱 Starting Ayala Land Payments Portal seed...\n')

  // ── 0. TRUNCATE ALL TABLES (idempotent re-run) ─────────────────────────────

  // Ensure supplier_invoices_col has created_at (missing in original DDL)
  await db.execute(sql.raw(`
    ALTER TABLE supplier_invoices_col
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW()
  `))

  // Ensure new columns exist (idempotent)
  await db.execute(sql.raw(`
    ALTER TABLE invoices_col ADD COLUMN IF NOT EXISTS total_penalties DECIMAL(12,2) NOT NULL DEFAULT 0;
    ALTER TABLE invoices_col ADD COLUMN IF NOT EXISTS penalties_paid DECIMAL(12,2) NOT NULL DEFAULT 0;
    ALTER TABLE supplier_invoices_col ADD COLUMN IF NOT EXISTS workflow_status VARCHAR(30) NOT NULL DEFAULT 'SUBMITTED';
    ALTER TABLE supplier_invoices_col ADD COLUMN IF NOT EXISTS claim_document_url TEXT;
    ALTER TABLE incoming_payments_col ALTER COLUMN invoice_id DROP NOT NULL;
  `))

  console.log('Truncating all tables...')
  // Single TRUNCATE statement for all tables — CASCADE handles FK deps, RESTART IDENTITY resets serials.
  await db.execute(sql.raw(`
    TRUNCATE TABLE
      penalty_config_col, penalty_ledger_col, payment_allocations_col, ap_workflow_events_col,
      cash_flow_forecasts_col, escalations_col, documents_col, insight_cards_col,
      payment_patterns_col, credit_risk_scores_col, delinquency_scores_col, payer_segments_col,
      three_way_matches_col, outgoing_payments_col, supplier_invoices_col, goods_receipts_col,
      purchase_orders_col, suppliers_col, incoming_payments_col, qr_codes_col,
      invoices_col, contracts_col, customers_col
    RESTART IDENTITY CASCADE
  `))
  console.log('  Tables truncated\n')

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
    const numContracts = ci < 10 ? 2 : 1 // First 10 customers get 2 contracts
    const isTenant = cust.type === 'TENANT'
    const tenantSpec = isTenant ? TENANT_SPECS[ci] : null

    for (let k = 0; k < numContracts; k++) {
      const contractNum = `ALI-CTR-${String(contractCounter).padStart(5, '0')}`
      const startDate = new Date(2023, randInt(0, 3), 1) // Jan-Apr 2023
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

  const insertedContracts = await db.insert(schema.contracts).values(contractRows).returning()
  console.log(`  Inserted ${insertedContracts.length} contracts`)

  // ── 3. INSERT INVOICES (3-6 months per contract, Oct 2025 – Mar 2026) ──────

  console.log('Inserting invoices...')
  const invoiceRows: (typeof schema.invoices.$inferInsert)[] = []
  let invoiceCounter = 1

  // Payment behaviour profiles — assigned per customer
  // 0=always_on_time  1=mostly_on_time  2=sometimes_late  3=often_late  4=delinquent
  const paymentProfiles = allCustomers.map((_, i) => {
    const r = rand()
    if (r < 0.35) return 0      // 35% always on time
    if (r < 0.60) return 1      // 25% mostly on time
    if (r < 0.78) return 2      // 18% sometimes late
    if (r < 0.90) return 3      // 12% often late
    return 4                     // 10% delinquent
  })

  for (const contract of insertedContracts) {
    const numMonths = randInt(3, 6)
    const monthsSlice = BILLING_MONTHS.slice(0, numMonths)

    for (const { year, month } of monthsSlice) {
      const periodStart = startOfMonth(year, month)
      const periodEnd = endOfMonth(year, month)
      const dueDate = addDays(periodEnd, 15) // Due 15th of following month
      const amount = Number(contract.monthlyAmount)
      const invoiceNum = `INV-${year}${String(month).padStart(2, '0')}-${String(invoiceCounter).padStart(5, '0')}`

      // Determine status based on profile and due date
      const custIndex = allCustomers.findIndex(c => c.customerId === contract.customerId)
      const profile = paymentProfiles[custIndex] ?? 0
      const now = new Date('2026-03-10')
      const isPast = dueDate < now

      let status: string
      let balanceRemaining: number

      if (!isPast) {
        // Future invoice — always PENDING
        status = 'PENDING'
        balanceRemaining = amount
      } else {
        // Past invoice — use profile to determine status
        const r = rand()
        if (profile === 0) {
          // Always on time
          status = 'PAID'
          balanceRemaining = 0
        } else if (profile === 1) {
          // Mostly on time
          if (r < 0.85) { status = 'PAID'; balanceRemaining = 0 }
          else if (r < 0.95) { status = 'PARTIAL'; balanceRemaining = amount * randInt(10, 40) / 100 }
          else { status = 'OVERDUE'; balanceRemaining = amount }
        } else if (profile === 2) {
          // Sometimes late
          if (r < 0.65) { status = 'PAID'; balanceRemaining = 0 }
          else if (r < 0.82) { status = 'PARTIAL'; balanceRemaining = amount * randInt(20, 60) / 100 }
          else { status = 'OVERDUE'; balanceRemaining = amount }
        } else if (profile === 3) {
          // Often late
          if (r < 0.40) { status = 'PAID'; balanceRemaining = 0 }
          else if (r < 0.65) { status = 'PARTIAL'; balanceRemaining = amount * randInt(30, 70) / 100 }
          else { status = 'OVERDUE'; balanceRemaining = amount }
        } else {
          // Delinquent
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

  const insertedInvoices = await db.insert(schema.invoices).values(invoiceRows).returning()
  console.log(`  Inserted ${insertedInvoices.length} invoices`)

  // ── 4. INSERT INCOMING PAYMENTS (for PAID and PARTIAL invoices) ───────────

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

  const insertedPayments = await db.insert(schema.incomingPayments).values(paymentRows).returning()
  console.log(`  Inserted ${insertedPayments.length} incoming payments`)

  // ── 5. INSERT SUPPLIERS ────────────────────────────────────────────────────

  console.log('Inserting 20 suppliers...')
  const supplierRows = SUPPLIER_SPECS.map((s, i) => ({
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

  // ── 6. INSERT PURCHASE ORDERS (2-3 per supplier) ─────────────────────────

  console.log('Inserting purchase orders...')
  const poRows: (typeof schema.purchaseOrders.$inferInsert)[] = []
  let poCounter = 1
  const poAmounts: number[] = []

  for (const supplier of insertedSuppliers) {
    const numPOs = randInt(2, 3)
    for (let k = 0; k < numPOs; k++) {
      const poNum = `PO-ALI-${String(poCounter).padStart(6, '0')}`
      const project = pick(AYALA_PROJECTS)
      const issuedDate = new Date(2025, randInt(6, 9), randInt(1, 28)) // Jul-Oct 2025
      const deliveryDays = randInt(60, 180)
      const amount = randInt(200_000, 5_000_000)
      poAmounts.push(amount)

      // Determine PO status based on date
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

  // ── 7. INSERT GOODS RECEIPTS (for received/closed POs) ───────────────────

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

  const insertedGRs = await db.insert(schema.goodsReceipts).values(grRows).returning()
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

  const insertedSIs = await db.insert(schema.supplierInvoices).values(siRows).returning()
  console.log(`  Inserted ${insertedSIs.length} supplier invoices`)

  // ── 9. INSERT OUTGOING PAYMENTS (for paid supplier invoices) ─────────────

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

  const insertedOPs = await db.insert(schema.outgoingPayments).values(opRows).returning()
  console.log(`  Inserted ${insertedOPs.length} outgoing payments`)

  // ── 10. INSERT 3-WAY MATCHES ──────────────────────────────────────────────

  console.log('Inserting 3-way matches...')

  // Build a map: poId -> { grId, siId } for matching
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
  let twmCounter = 1

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

    // Weighted match status: 70% FULL, 15% PARTIAL, 15% MISMATCH
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
    twmCounter++
  }

  const insertedTWMs = await db.insert(schema.threeWayMatches).values(twmRows).returning()
  console.log(`  Inserted ${insertedTWMs.length} 3-way matches`)

  // ── 11. INSERT ML SCORES ──────────────────────────────────────────────────

  console.log('Inserting ML scores (payer_segments, delinquency, credit_risk, payment_patterns)...')

  // Payer segments
  const segmentNames = ['CHAMPION', 'LOYAL', 'AT_RISK', 'LAPSED', 'PROMISING']
  const payerSegRows = allCustomers.map((c, i) => {
    const profile = paymentProfiles[i] ?? 0
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
  await db.insert(schema.payerSegments).values(payerSegRows)
  console.log(`  Inserted ${payerSegRows.length} payer segments`)

  // Delinquency scores
  const delinqRows = allCustomers.map((c, i) => {
    const profile = paymentProfiles[i] ?? 0
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
  await db.insert(schema.delinquencyScores).values(delinqRows)
  console.log(`  Inserted ${delinqRows.length} delinquency scores`)

  // Credit risk scores
  const creditRiskRows = allCustomers.map((c, i) => {
    const profile = paymentProfiles[i] ?? 0
    const baseRisk = [0.03, 0.10, 0.25, 0.50, 0.80][profile]
    const riskScore = Math.min(0.9999, Math.max(0.0001, baseRisk + (rand() - 0.5) * 0.12))
    const riskLevel = riskScore < 0.20 ? 'LOW' : riskScore < 0.50 ? 'MEDIUM' : 'HIGH'
    const custInvoices = insertedInvoices.filter(inv => inv.customerId === c.customerId)
    const outstanding = custInvoices
      .filter(inv => inv.status !== 'PAID')
      .reduce((sum, inv) => sum + Number(inv.balanceRemaining), 0)
    const totalBilled = custInvoices.reduce((sum, inv) => sum + Number(inv.amount), 0)

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
  await db.insert(schema.creditRiskScores).values(creditRiskRows)
  console.log(`  Inserted ${creditRiskRows.length} credit risk scores`)

  // Payment patterns
  const paymentPatternRows = allCustomers.map((c, i) => {
    const profile = paymentProfiles[i] ?? 0
    return {
      customerId: c.customerId!,
      avgDaysToPay: String((3 + profile * 7 + randInt(-2, 5)).toFixed(1)),
      preferredMethod: pick(PAYMENT_METHODS),
      typicalPaymentDay: randInt(1, 28),
      partialPaymentRate: String((profile * 8 + randInt(0, 10)).toFixed(2)),
    }
  })
  await db.insert(schema.paymentPatterns).values(paymentPatternRows)
  console.log(`  Inserted ${paymentPatternRows.length} payment patterns`)

  // ── 12. INSERT INSIGHT CARDS ──────────────────────────────────────────────

  console.log('Inserting insight cards...')

  // Find some high-risk customers for realistic insights
  const overdueInvoices = insertedInvoices.filter(i => i.status === 'OVERDUE')
  const highRiskCustomerIds = delinqRows
    .filter(d => d.riskLevel === 'HIGH')
    .slice(0, 3)
    .map(d => d.customerId)

  const totalOverdueAmount = overdueInvoices.reduce((s, i) => s + Number(i.amount), 0)
  const overdueCount = overdueInvoices.length

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
      body: `${insertedTWMs.filter(m => m.matchStatus === 'MISMATCH').length} purchase order invoices have failed 3-way matching. Total value at risk: ₱${(insertedTWMs.filter(m => m.matchStatus === 'MISMATCH').reduce((s, m) => s + Number(m.invoiceAmount), 0) / 1_000_000).toFixed(1)}M. Review before payment release.`,
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
      body: `ML delinquency model has flagged ${highRiskCustomerIds.length} tenant accounts with risk scores above 0.70. Proactive outreach recommended to avoid escalation to legal collections.`,
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

  // Use first 3 invoices that have payments
  const paidInvoices = insertedInvoices.filter(i => i.status === 'PAID').slice(0, 3)
  const paidPayments = insertedPayments.filter(p =>
    paidInvoices.some(i => i.invoiceId === p.invoiceId)
  ).slice(0, 3)

  const docRows: (typeof schema.documents.$inferInsert)[] = [
    {
      customerId: paidInvoices[0]?.customerId ?? allCustomers[0].customerId!,
      invoiceId: paidInvoices[0]?.invoiceId,
      paymentId: paidPayments[0]?.paymentId,
      fileUrl: 'https://storage.ayalaland.com/docs/payment-receipts/receipt-001.pdf',
      fileName: 'payment_receipt_oct2025.pdf',
      fileType: 'application/pdf',
      ocrResult: JSON.stringify({
        extractedText: 'OFFICIAL RECEIPT\nDate: November 14, 2025\nReceived from: Globe Telecom Inc.\nAmount: PHP 1,125,000.00\nFor: Rental payment — One Ayala East Tower 20F October 2025',
        confidence: 0.97,
        fields: {
          payerName: 'Globe Telecom Inc.',
          amount: 1125000.00,
          date: '2025-11-14',
          purpose: 'Rental payment',
        },
      }),
      ocrStatus: 'COMPLETED',
      validationResult: JSON.stringify({
        status: 'VALID',
        matchedInvoice: true,
        amountMatches: true,
        payerMatches: true,
      }),
    },
    {
      customerId: paidInvoices[1]?.customerId ?? allCustomers[1].customerId!,
      invoiceId: paidInvoices[1]?.invoiceId,
      paymentId: paidPayments[1]?.paymentId,
      fileUrl: 'https://storage.ayalaland.com/docs/payment-receipts/receipt-002.pdf',
      fileName: 'bank_transfer_confirmation_nov2025.pdf',
      fileType: 'application/pdf',
      ocrResult: JSON.stringify({
        extractedText: 'BANK TRANSFER CONFIRMATION\nDate: December 12, 2025\nBeneficiary: Ayala Land Inc.\nAmount: PHP 2,250,000.00\nReference: TRF-2025121200045\nSender: IKEA Philippines',
        confidence: 0.94,
        fields: {
          payerName: 'IKEA Philippines',
          amount: 2250000.00,
          date: '2025-12-12',
          referenceNumber: 'TRF-2025121200045',
        },
      }),
      ocrStatus: 'COMPLETED',
      validationResult: JSON.stringify({
        status: 'VALID',
        matchedInvoice: true,
        amountMatches: true,
        payerMatches: true,
      }),
    },
    {
      customerId: allCustomers[12]?.customerId ?? allCustomers[2].customerId!,
      invoiceId: insertedInvoices.find(i => i.customerId === allCustomers[12]?.customerId && i.status === 'OVERDUE')?.invoiceId,
      paymentId: null,
      fileUrl: 'https://storage.ayalaland.com/docs/disputes/dispute-letter-001.pdf',
      fileName: 'dispute_letter_jpmorgan_jan2026.pdf',
      fileType: 'application/pdf',
      ocrResult: JSON.stringify({
        extractedText: 'FORMAL LETTER OF DISPUTE\nDate: February 3, 2026\nTo: Ayala Land Inc. Property Management\nRe: Invoice ALI-INV-2026-001 — We wish to dispute the service charges...',
        confidence: 0.91,
        fields: {
          letterType: 'DISPUTE',
          sender: 'JP Morgan Chase Bank N.A.',
          date: '2026-02-03',
          subject: 'Invoice dispute',
        },
      }),
      ocrStatus: 'COMPLETED',
      validationResult: JSON.stringify({
        status: 'DISPUTED',
        requiresReview: true,
        disputeType: 'SERVICE_CHARGE',
        escalationRequired: true,
      }),
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

  // Monthly forecasts Apr 2026 – Sep 2026
  const forecastMonths = [
    { year: 2026, month: 4 },
    { year: 2026, month: 5 },
    { year: 2026, month: 6 },
    { year: 2026, month: 7 },
    { year: 2026, month: 8 },
    { year: 2026, month: 9 },
  ]

  // Simulate a growth trend with seasonal variation
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

  // Batch insert penalties in chunks of 50
  for (let i = 0; i < penaltyBatch.length; i += 50) {
    const chunk = penaltyBatch.slice(i, i + 50)
    await db.insert(penaltyLedger).values(chunk)
  }

  // Update denormalized totals on invoices (single SQL call)
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
  // Batch insert in chunks of 50
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

  // Batch update workflow statuses (single SQL call)
  if (statusUpdates.length > 0) {
    const cases = statusUpdates.map(({ id, status }) =>
      `WHEN ${id} THEN '${status}'`
    ).join(' ')
    const ids = statusUpdates.map(({ id }) => id).join(',')
    await db.execute(sql.raw(
      `UPDATE supplier_invoices_col SET workflow_status = CASE supplier_invoice_id ${cases} END WHERE supplier_invoice_id IN (${ids})`
    ))
  }

  // Batch insert workflow events in chunks of 50
  for (let i = 0; i < eventBatch.length; i += 50) {
    const chunk = eventBatch.slice(i, i + 50)
    await db.insert(apWorkflowEvents).values(chunk)
  }
  console.log(`  ${eventCount} AP workflow events seeded`)

  // ── Summary ───────────────────────────────────────────────────────────────

  console.log('\n✅ Seed complete! Summary:')
  console.log(`  Customers:           ${allCustomers.length} (${insertedTenants.length} tenants + ${insertedPMs.length} property managers)`)
  console.log(`  Contracts:           ${insertedContracts.length}`)
  console.log(`  Invoices:            ${insertedInvoices.length}`)
  console.log(`  Incoming Payments:   ${insertedPayments.length}`)
  console.log(`  Suppliers:           ${insertedSuppliers.length}`)
  console.log(`  Purchase Orders:     ${insertedPOs.length}`)
  console.log(`  Goods Receipts:      ${insertedGRs.length}`)
  console.log(`  Supplier Invoices:   ${insertedSIs.length}`)
  console.log(`  Outgoing Payments:   ${insertedOPs.length}`)
  console.log(`  3-Way Matches:       ${insertedTWMs.length}`)
  console.log(`  ML Scores:           ${allCustomers.length * 4} (4 tables × ${allCustomers.length} customers)`)
  console.log(`  Insight Cards:       ${insightRows.length}`)
  console.log(`  Documents:           ${insertedDocs.length}`)
  console.log(`  Escalations:         ${escalationRows.length}`)
  console.log(`  Cash Flow Forecasts: ${cfRows.length}`)
}
