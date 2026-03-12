// Generates SQL statements for seeding payable data, outputs to stdout
// Usage: npx tsx scripts/seed-payable.ts > /tmp/seed-payable.sql

function rand() { return Math.random() }
function randInt(min: number, max: number) { return Math.floor(rand() * (max - min + 1)) + min }
function pick<T>(arr: T[]): T { return arr[Math.floor(rand() * arr.length)] }
function pickWeighted<T>(items: T[], weights: number[]): T {
  const total = weights.reduce((a, b) => a + b, 0)
  let r = rand() * total
  for (let i = 0; i < items.length; i++) {
    r -= weights[i]
    if (r <= 0) return items[i]
  }
  return items[items.length - 1]
}
function fmtDate(d: Date): string { return d.toISOString().slice(0, 10) }
function addDays(d: Date, n: number): Date { const r = new Date(d); r.setDate(r.getDate() + n); return r }
function esc(s: string | null | undefined): string {
  if (s == null) return 'NULL'
  return `'${s.replace(/'/g, "''")}'`
}

const AYALA_PROJECTS = [
  'Ayala Triangle Gardens Tower 2', 'Park Central Towers - BGC',
  'Arca South Mixed-Use Dev', 'One Ayala Avenue',
  'Circuit Makati Phase 3', 'Vertis North Office Tower',
  'Alveo Financial Tower', 'Seda Lio El Nido Resort',
  'The Courtyards Vermosa', 'Ayala Malls Manila Bay',
  'Nuvali Evoliving Phase 4', 'Makati Diamond Residences',
]
const PAYMENT_METHODS = ['BANK_TRANSFER', 'CHECK', 'WIRE_TRANSFER', 'CORPORATE_CARD']
const UNITS = ['MT', 'UNITS', 'SQFT', 'SQM', 'LOT', 'SETS']
const RECEIVERS = ['Rodolfo Padua', 'Mylene Quizon', 'Arsenio Rebollos', 'Divina Sagun', 'Renato Tacloban', 'Carmen Villanueva']
const REVIEWERS = ['Ana Reyes', 'Jose Santos', 'Maria Cruz', 'Roberto Aquino', 'Josephine Beltran']
const APPROVERS = ['Roberto Santos', 'Josephine Aquino', 'Victor Beltran', 'Amelia Corpuz']
const SUPPLIER_CATEGORIES = [
  'Construction', 'Construction', 'Engineering & Construction', 'Civil Works',
  'Construction', 'Heavy Equipment', 'Cement & Materials', 'Cement & Materials',
  'Steel & Metal', 'Steel & Metal', 'Electrical Systems', 'Electrical & Automation',
  'HVAC', 'HVAC', 'Elevators & Lifts', 'Elevators & Escalators',
  'Petrochemicals & Materials', 'Paints & Coatings', 'Building Materials', 'Interior Finishes',
]

// Output SQL
const sql: string[] = []

// Clean existing data
sql.push('DELETE FROM three_way_matches_col;')
sql.push('DELETE FROM outgoing_payments_col;')
sql.push('DELETE FROM supplier_invoices_col;')
sql.push('DELETE FROM goods_receipts_col;')
sql.push('DELETE FROM purchase_orders_col;')

// Generate POs
interface PO { poNumber: string; supplierId: number; project: string; desc: string; amount: number; issuedDate: string; expectedDelivery: string; status: string }
const allPOs: PO[] = []
let poCounter = 1

for (let suppId = 1; suppId <= 20; suppId++) {
  const category = SUPPLIER_CATEGORIES[suppId - 1]
  const numPOs = randInt(2, 3)
  for (let k = 0; k < numPOs; k++) {
    const poNum = `PO-ALI-${String(poCounter).padStart(6, '0')}`
    const project = pick(AYALA_PROJECTS)
    const issuedDate = new Date(2025, randInt(6, 9), randInt(1, 28))
    const deliveryDays = randInt(60, 180)
    const expectedDelivery = addDays(issuedDate, deliveryDays)
    const amount = randInt(5_000_000, 500_000_000)
    const now = new Date('2026-03-10')

    let poStatus: string
    if (expectedDelivery < now && rand() > 0.2) {
      poStatus = pickWeighted(['CLOSED', 'RECEIVED', 'PARTIAL'], [50, 30, 20])
    } else {
      poStatus = pickWeighted(['OPEN', 'APPROVED', 'PARTIAL'], [40, 40, 20])
    }

    const desc = `Supply of ${category} for ${project} — Phase ${randInt(1, 3)}`

    sql.push(`INSERT INTO purchase_orders_col (po_number, supplier_id, project_name, description, total_amount, issued_date, expected_delivery, status) VALUES (${esc(poNum)}, ${suppId}, ${esc(project)}, ${esc(desc)}, ${amount.toFixed(2)}, ${esc(fmtDate(issuedDate))}, ${esc(fmtDate(expectedDelivery))}, ${esc(poStatus)});`)

    allPOs.push({ poNumber: poNum, supplierId: suppId, project, desc, amount, issuedDate: fmtDate(issuedDate), expectedDelivery: fmtDate(expectedDelivery), status: poStatus })
    poCounter++
  }
}

// We need PO IDs - use po_number as reference since we control them
// Generate GRs, SIs, OPs, TWMs referencing by po_number
// Use subqueries to get IDs

let grCounter = 1
let siCounter = 1
let opCounter = 1

interface GRInfo { grNum: string; poNum: string; suppId: number; amount: number; receivedDate: string }
interface SIInfo { siNum: string; poNum: string; suppId: number; amount: number; submittedDate: string; dueDate: string; paymentStatus: string; amountPaid: number; paymentDate: string | null }

const allGRs: GRInfo[] = []
const allSIs: SIInfo[] = []

for (const po of allPOs) {
  if (['RECEIVED', 'CLOSED', 'PARTIAL'].includes(po.status)) {
    const numGRs = po.status === 'PARTIAL' ? 1 : randInt(1, 2)
    for (let k = 0; k < numGRs; k++) {
      const receivedDate = addDays(new Date(po.issuedDate), randInt(30, 120))
      const pctReceived = po.status === 'PARTIAL' ? randInt(40, 80) / 100 : (k === 0 && numGRs === 2 ? 0.6 : 1.0)
      const amount = po.amount * pctReceived
      const grNum = `GR-${String(grCounter).padStart(6, '0')}`
      const condition = pickWeighted(
        ['All items in good condition', 'Minor packaging damage, items intact', 'Complete and verified', null],
        [60, 15, 20, 5]
      )

      sql.push(`INSERT INTO goods_receipts_col (po_id, supplier_id, receipt_number, received_date, received_by, description, quantity_received, unit, amount, condition_notes) VALUES ((SELECT po_id FROM purchase_orders_col WHERE po_number = ${esc(po.poNumber)}), ${po.supplierId}, ${esc(grNum)}, ${esc(fmtDate(receivedDate))}, ${esc(pick(RECEIVERS))}, ${esc(`Goods receipt for ${po.desc}`)}, ${(pctReceived * 100).toFixed(2)}, ${esc(pick(UNITS))}, ${amount.toFixed(2)}, ${esc(condition)});`)

      allGRs.push({ grNum, poNum: po.poNumber, suppId: po.supplierId, amount, receivedDate: fmtDate(receivedDate) })
      grCounter++
    }
  }
}

// SIs - one per GR
for (const gr of allGRs) {
  const submittedDate = addDays(new Date(gr.receivedDate), randInt(5, 21))
  const dueDate = addDays(submittedDate, 30)
  const amount = gr.amount
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
    } else {
      paymentStatus = 'UNPAID'
      amountPaid = 0
    }
  }

  const siNum = `SINV-${String(siCounter).padStart(6, '0')}`
  sql.push(`INSERT INTO supplier_invoices_col (supplier_id, po_id, invoice_number, amount, submitted_date, due_date, payment_status, amount_paid, payment_date) VALUES (${gr.suppId}, (SELECT po_id FROM purchase_orders_col WHERE po_number = ${esc(gr.poNum)}), ${esc(siNum)}, ${amount.toFixed(2)}, ${esc(fmtDate(submittedDate))}, ${esc(fmtDate(dueDate))}, ${esc(paymentStatus)}, ${amountPaid.toFixed(2)}, ${esc(paymentDate)});`)

  allSIs.push({ siNum, poNum: gr.poNum, suppId: gr.suppId, amount, submittedDate: fmtDate(submittedDate), dueDate: fmtDate(dueDate), paymentStatus, amountPaid, paymentDate })
  siCounter++
}

// Outgoing payments
for (const si of allSIs) {
  if (si.paymentStatus === 'PAID' || si.paymentStatus === 'PARTIAL') {
    const amount = si.amountPaid
    const payDate = si.paymentDate ?? fmtDate(addDays(new Date(si.dueDate), randInt(0, 15)))

    sql.push(`INSERT INTO outgoing_payments_col (supplier_invoice_id, supplier_id, amount, payment_method, payment_date, reference_number, approved_by, status) VALUES ((SELECT supplier_invoice_id FROM supplier_invoices_col WHERE invoice_number = ${esc(si.siNum)}), ${si.suppId}, ${amount.toFixed(2)}, ${esc(pick(PAYMENT_METHODS))}, ${esc(payDate)}, ${esc(`OP-REF-${String(opCounter).padStart(7, '0')}`)}, ${esc(pick(APPROVERS))}, 'COMPLETED');`)
    opCounter++
  }
}

// 3-way matches - group by PO
const poToGR = new Map<string, GRInfo[]>()
const poToSI = new Map<string, SIInfo[]>()

for (const gr of allGRs) {
  if (!poToGR.has(gr.poNum)) poToGR.set(gr.poNum, [])
  poToGR.get(gr.poNum)!.push(gr)
}
for (const si of allSIs) {
  if (!poToSI.has(si.poNum)) poToSI.set(si.poNum, [])
  poToSI.get(si.poNum)!.push(si)
}

let twmCount = 0
for (const [poNum, grs] of poToGR) {
  const sis = poToSI.get(poNum)
  if (!sis || sis.length === 0) continue

  const gr = grs[0]
  const si = sis[0]
  const po = allPOs.find(p => p.poNumber === poNum)!

  const poAmt = po.amount
  const grAmt = gr.amount
  const siAmt = si.amount

  const matchStatus = pickWeighted(['FULL_MATCH', 'PARTIAL_MATCH', 'MISMATCH'], [70, 15, 15])

  let discrepancies: string = 'NULL'
  let aiNotes: string = 'NULL'

  if (matchStatus === 'PARTIAL_MATCH') {
    const diff = siAmt - grAmt
    discrepancies = esc(JSON.stringify({
      type: 'AMOUNT_VARIANCE',
      grAmount: grAmt,
      invoiceAmount: siAmt,
      variance: diff.toFixed(2),
      variancePct: ((Math.abs(diff) / grAmt) * 100).toFixed(1),
    }))
    aiNotes = esc(`Invoice amount differs from received amount by PHP ${Math.abs(diff).toLocaleString()}. Suggest requesting credit note or splitting payment.`)
  } else if (matchStatus === 'MISMATCH') {
    discrepancies = esc(JSON.stringify({
      type: 'SIGNIFICANT_VARIANCE',
      poAmount: poAmt,
      grAmount: grAmt,
      invoiceAmount: siAmt * 1.15,
      issues: ['Amount mismatch exceeds tolerance', 'Unit price discrepancy detected'],
    }))
    aiNotes = esc('Significant mismatch detected. Invoice amount exceeds tolerance of 5%. Manual review required before payment approval.')
  }

  const reviewedBy = matchStatus !== 'PENDING_REVIEW' ? esc(pick(REVIEWERS)) : 'NULL'
  const reviewedAt = matchStatus === 'FULL_MATCH' ? esc(fmtDate(addDays(new Date(si.submittedDate), randInt(1, 5)))) : 'NULL'

  sql.push(`INSERT INTO three_way_matches_col (po_id, receipt_id, supplier_invoice_id, supplier_id, match_status, po_amount, receipt_amount, invoice_amount, discrepancies, ai_notes, reviewed_by, reviewed_at) VALUES ((SELECT po_id FROM purchase_orders_col WHERE po_number = ${esc(poNum)}), (SELECT receipt_id FROM goods_receipts_col WHERE receipt_number = ${esc(gr.grNum)}), (SELECT supplier_invoice_id FROM supplier_invoices_col WHERE invoice_number = ${esc(si.siNum)}), ${gr.suppId}, ${esc(matchStatus)}, ${poAmt.toFixed(2)}, ${grAmt.toFixed(2)}, ${siAmt.toFixed(2)}, ${discrepancies}, ${aiNotes}, ${reviewedBy}, ${reviewedAt});`)
  twmCount++
}

// Output summary as comment
sql.push(`-- Summary: ${allPOs.length} POs, ${allGRs.length} GRs, ${allSIs.length} SIs, ${opCounter - 1} OPs, ${twmCount} 3-way matches`)

// Print all SQL
console.log(sql.join('\n'))
