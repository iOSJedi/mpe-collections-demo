# CWT Automation (Phase 2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a full demo of automated BIR 2307 issuance inside `mpe-collections-demo` and a Searce-branded pptx proposal deck that pitches it as a Phase-2 expansion of the Collections engagement to Ayala Land AR leadership.

**Architecture:** Tenant-side one-time enrollment captures a durable authorization and stored signature; Ayala-side auto-issuance engine fires on each `incoming_payments` row, detects the 5 % withholding gap against the invoice, renders a BIR 2307 from the official fillable PDF via `pdf-lib`, stamps the stored signature, posts a synthetic CWT payment to close the invoice, and emails the tenant. A Gemini-backed intelligence layer handles ATC classification for ambiguous contracts and OCR ingestion of 2307s from non-enrolled tenants. A presenter-facing emulator button drives a reproducible ~5 s magic moment for the pitch. Screenshots captured by Playwright feed a `python-pptx` script that emits the Searce-branded deck.

**Tech Stack:** Next.js 16, Drizzle ORM over Supabase SQL proxy, Firebase auth, Redux Toolkit, Gemini 2.5-Flash (existing), `pdf-lib` (new), Satori + `sharp` (new, signature PNG gen), Playwright (new, screenshot capture), `python-pptx` (new, deck build).

**Spec:** `docs/superpowers/specs/2026-04-21-cwt-automation-phase2-design.md`

---

## Conventions used throughout this plan

- All `cd` commands into the app live at `~/projects/mpe-collections-demo/app`. All deck work at `~/projects/searce/ayalaland/decks`.
- All schema changes are pushed through the Supabase SQL proxy using the pattern in `CLAUDE.md` (never `drizzle-kit push`).
- Firebase `withAuth()` wraps tenant-admin API routes; payer-portal routes accept the QR JWT token, matching the pattern in `src/app/api/ocr/route.ts`.
- Seeded PRNG is already set to `seed = 42` in `lib/seed.ts`; reuse it for all new deterministic data so screenshots stay stable.
- The money field format everywhere is `decimal(12,2)` as strings on the client, matching existing `invoices_col` / `incoming_payments_col` patterns.
- Commit after every task. Conventional-commit prefixes: `feat`, `fix`, `chore`, `docs`, `test`.

---

## Phase 0 — Project prerequisites

### Task 0.1: Install new dependencies

**Files:** Modify `app/package.json`, `app/package-lock.json`.

- [ ] **Step 1: Install runtime deps**

```bash
cd ~/projects/mpe-collections-demo/app
npm install pdf-lib @pdf-lib/fontkit
```

- [ ] **Step 2: Install dev deps**

```bash
npm install -D vitest @vitest/ui satori @resvg/resvg-js playwright
npx playwright install chromium
```

- [ ] **Step 3: Add test + script entries**

Open `app/package.json`, replace the `scripts` block with:

```json
"scripts": {
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "lint": "eslint",
  "test": "vitest run",
  "test:watch": "vitest",
  "gen:signatures": "tsx scripts/generate-signatures.ts",
  "gen:pdf-fields": "tsx scripts/extract-2307-fields.ts",
  "screenshot": "tsx scripts/capture-screenshots.ts"
}
```

- [ ] **Step 4: Add minimal vitest config**

Create `app/vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config'
import path from 'node:path'
export default defineConfig({
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
```

- [ ] **Step 5: Commit**

```bash
git add app/package.json app/package-lock.json app/vitest.config.ts
git commit -m "chore: add pdf-lib, vitest, satori, playwright for CWT phase 2"
```

### Task 0.2: Fetch BIR 2307 fillable PDF template

**Files:** Create `app/public/forms/BIR-2307-fillable.pdf`.

- [ ] **Step 1: Download the official template**

Fetch `https://www.bir.gov.ph/images/bir_files/taxpayers_service_programs_and_monitoring_1/2307%20Jan%202018%20ENCS%20final.pdf` (or the currently-linked fillable version on bir.gov.ph). If the URL has moved, navigate from `bir.gov.ph → BIR Forms → Payment/Remittance Forms` and save the 2307 fillable PDF manually.

```bash
cd ~/projects/mpe-collections-demo/app
mkdir -p public/forms
curl -L -o public/forms/BIR-2307-fillable.pdf \
  "https://www.bir.gov.ph/images/bir_files/taxpayers_service_programs_and_monitoring_1/2307%20Jan%202018%20ENCS%20final.pdf"
```

- [ ] **Step 2: Verify it's a fillable PDF**

```bash
node -e "import('pdf-lib').then(async ({PDFDocument}) => { const b = await (await fetch('file://'+process.cwd()+'/public/forms/BIR-2307-fillable.pdf')).arrayBuffer(); const d = await PDFDocument.load(b); console.log('fields:', d.getForm().getFields().length); })"
```

Expected: prints a field count > 30. If it prints `0`, the PDF is flattened — retry with a different source.

- [ ] **Step 3: Commit**

```bash
git add app/public/forms/BIR-2307-fillable.pdf
git commit -m "chore: add official BIR 2307 fillable PDF template"
```

---

## Phase 1 — Schema delta + pure libs

### Task 1.1: Schema delta — push DDL through SQL proxy

**Files:** Modify `app/src/db/schema.ts`; run SQL-proxy pushes.

- [ ] **Step 1: Push `customers_col` column additions**

```bash
source ~/projects/mpe-collections-demo/app/.env
for COL in \
  "tin VARCHAR(15)" \
  "branch_code VARCHAR(5)" \
  "rdo_code VARCHAR(3)" \
  "tax_classification VARCHAR(20)" \
  "is_top_withholding_agent BOOLEAN DEFAULT FALSE" \
  "authorized_signatory_name VARCHAR(200)" \
  "authorized_signatory_email VARCHAR(200)" \
  "signature_image_url TEXT" \
  "withholding_rate_pct DECIMAL(5,2) DEFAULT 5.00" \
  "cwt_atc_code VARCHAR(10) DEFAULT 'WC100'" \
  "cwt_auto_issue_enrolled_at TIMESTAMP" \
  "cwt_authorization_document_id INTEGER"; do
  COLNAME=$(echo "$COL" | awk '{print $1}')
  curl -s -X POST "$SUPABASE_SQL_PROXY_URL" \
    -H "Content-Type: application/json" \
    -H "x-api-key: $SUPABASE_SQL_PROXY_KEY" \
    -d "{\"sql\":\"ALTER TABLE customers_col ADD COLUMN IF NOT EXISTS $COL;\",\"params\":[],\"method\":\"execute\"}"
  echo " <- $COLNAME"
done
```

- [ ] **Step 2: Create `cwt_certificates_col` table**

```bash
curl -s -X POST "$SUPABASE_SQL_PROXY_URL" \
  -H "Content-Type: application/json" \
  -H "x-api-key: $SUPABASE_SQL_PROXY_KEY" \
  -d @- <<'EOF'
{"sql":"CREATE TABLE IF NOT EXISTS cwt_certificates_col (certificate_id SERIAL PRIMARY KEY, customer_id INTEGER NOT NULL REFERENCES customers_col(customer_id), contract_id INTEGER REFERENCES contracts_col(contract_id), invoice_id INTEGER NOT NULL REFERENCES invoices_col(invoice_id), payment_id INTEGER REFERENCES incoming_payments_col(payment_id), gross_amount DECIMAL(12,2) NOT NULL, withheld_amount DECIMAL(12,2) NOT NULL, rate_pct DECIMAL(5,2) NOT NULL, atc_code VARCHAR(10) NOT NULL, period_start DATE NOT NULL, period_end DATE NOT NULL, reference_number VARCHAR(15) NOT NULL UNIQUE, pdf_url TEXT, signature_applied BOOLEAN DEFAULT FALSE, status VARCHAR(20) NOT NULL DEFAULT 'DRAFT', source VARCHAR(20) NOT NULL DEFAULT 'AUTO_ENROLLED', signed_by_name VARCHAR(200), signed_by_email VARCHAR(200), issued_at TIMESTAMP, created_at TIMESTAMP DEFAULT NOW());","params":[],"method":"execute"}
EOF
```

- [ ] **Step 3: Add indexes**

```bash
for IDX in \
  "idx_cwt_customer ON cwt_certificates_col(customer_id)" \
  "idx_cwt_invoice ON cwt_certificates_col(invoice_id)" \
  "idx_cwt_status ON cwt_certificates_col(status)" \
  "idx_cwt_issued_at ON cwt_certificates_col(issued_at)"; do
  curl -s -X POST "$SUPABASE_SQL_PROXY_URL" \
    -H "Content-Type: application/json" \
    -H "x-api-key: $SUPABASE_SQL_PROXY_KEY" \
    -d "{\"sql\":\"CREATE INDEX IF NOT EXISTS $IDX;\",\"params\":[],\"method\":\"execute\"}"
done
```

- [ ] **Step 4: Add `incoming_payments_col` columns**

```bash
for COL in \
  "cwt_amount DECIMAL(12,2)" \
  "cwt_certificate_id INTEGER"; do
  curl -s -X POST "$SUPABASE_SQL_PROXY_URL" \
    -H "Content-Type: application/json" \
    -H "x-api-key: $SUPABASE_SQL_PROXY_KEY" \
    -d "{\"sql\":\"ALTER TABLE incoming_payments_col ADD COLUMN IF NOT EXISTS $COL;\",\"params\":[],\"method\":\"execute\"}"
done
```

- [ ] **Step 5: Update Drizzle schema**

Open `app/src/db/schema.ts`. In the `customers` table, append:

```ts
tin: varchar('tin', { length: 15 }),
branchCode: varchar('branch_code', { length: 5 }),
rdoCode: varchar('rdo_code', { length: 3 }),
taxClassification: varchar('tax_classification', { length: 20 }),
isTopWithholdingAgent: boolean('is_top_withholding_agent').default(false),
authorizedSignatoryName: varchar('authorized_signatory_name', { length: 200 }),
authorizedSignatoryEmail: varchar('authorized_signatory_email', { length: 200 }),
signatureImageUrl: text('signature_image_url'),
withholdingRatePct: decimal('withholding_rate_pct', { precision: 5, scale: 2 }).default('5.00'),
cwtAtcCode: varchar('cwt_atc_code', { length: 10 }).default('WC100'),
cwtAutoIssueEnrolledAt: timestamp('cwt_auto_issue_enrolled_at'),
cwtAuthorizationDocumentId: integer('cwt_authorization_document_id'),
```

In the `incomingPayments` table, append:

```ts
cwtAmount: decimal('cwt_amount', { precision: 12, scale: 2 }),
cwtCertificateId: integer('cwt_certificate_id'),
```

Add a new export at the bottom of the AR section:

```ts
export const cwtCertificates = pgTable('cwt_certificates_col', {
  certificateId: serial('certificate_id').primaryKey(),
  customerId: integer('customer_id').notNull().references(() => customers.customerId),
  contractId: integer('contract_id').references(() => contracts.contractId),
  invoiceId: integer('invoice_id').notNull().references(() => invoices.invoiceId),
  paymentId: integer('payment_id').references(() => incomingPayments.paymentId),
  grossAmount: decimal('gross_amount', { precision: 12, scale: 2 }).notNull(),
  withheldAmount: decimal('withheld_amount', { precision: 12, scale: 2 }).notNull(),
  ratePct: decimal('rate_pct', { precision: 5, scale: 2 }).notNull(),
  atcCode: varchar('atc_code', { length: 10 }).notNull(),
  periodStart: date('period_start').notNull(),
  periodEnd: date('period_end').notNull(),
  referenceNumber: varchar('reference_number', { length: 15 }).notNull().unique(),
  pdfUrl: text('pdf_url'),
  signatureApplied: boolean('signature_applied').default(false),
  status: varchar('status', { length: 20 }).notNull().default('DRAFT'),
  source: varchar('source', { length: 20 }).notNull().default('AUTO_ENROLLED'),
  signedByName: varchar('signed_by_name', { length: 200 }),
  signedByEmail: varchar('signed_by_email', { length: 200 }),
  issuedAt: timestamp('issued_at'),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => [
  index('idx_cwt_customer_col').on(table.customerId),
  index('idx_cwt_invoice_col').on(table.invoiceId),
  index('idx_cwt_status_col').on(table.status),
  index('idx_cwt_issued_at_col').on(table.issuedAt),
])
```

- [ ] **Step 6: Verify schema**

```bash
curl -s -X POST "$SUPABASE_SQL_PROXY_URL" \
  -H "Content-Type: application/json" \
  -H "x-api-key: $SUPABASE_SQL_PROXY_KEY" \
  -d '{"sql":"SELECT column_name FROM information_schema.columns WHERE table_name = 'cwt_certificates_col' ORDER BY ordinal_position;","params":[],"method":"all"}'
```

Expected: 20 rows printed covering every `cwt_certificates_col` column.

- [ ] **Step 7: Commit**

```bash
git add app/src/db/schema.ts
git commit -m "feat(schema): add CWT certificates table and enrollment columns"
```

### Task 1.2: Rates table (`lib/cwt/rates.ts`)

**Files:** Create `app/src/lib/cwt/rates.ts`, `app/src/lib/cwt/rates.test.ts`.

- [ ] **Step 1: Write the failing test**

Create `app/src/lib/cwt/rates.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { atcFor, defaultRateFor } from './rates'

describe('atcFor', () => {
  it('returns WC100 (5%) for lease to private corporate', () => {
    expect(atcFor({ contractType: 'LEASE', taxClassification: 'PRIVATE' })).toEqual({ code: 'WC100', ratePct: 5 })
  })
  it('returns WC640 (5%) for government lessee', () => {
    expect(atcFor({ contractType: 'LEASE', taxClassification: 'GOVT' })).toEqual({ code: 'WC640', ratePct: 5 })
  })
  it('returns WC158 (2%) for services', () => {
    expect(atcFor({ contractType: 'SERVICE', taxClassification: 'PRIVATE' })).toEqual({ code: 'WC158', ratePct: 2 })
  })
  it('returns null for concession (not subject to EWT on rental)', () => {
    expect(atcFor({ contractType: 'CONCESSION', taxClassification: 'PRIVATE' })).toBeNull()
  })
})

describe('defaultRateFor', () => {
  it('returns 5 for LEASE', () => { expect(defaultRateFor('LEASE')).toBe(5) })
  it('returns 2 for SERVICE', () => { expect(defaultRateFor('SERVICE')).toBe(2) })
  it('returns 0 for CONCESSION', () => { expect(defaultRateFor('CONCESSION')).toBe(0) })
})
```

- [ ] **Step 2: Run the test to confirm failure**

```bash
cd ~/projects/mpe-collections-demo/app && npm test -- rates
```

Expected: fails with "Cannot find module './rates'".

- [ ] **Step 3: Implement `rates.ts`**

Create `app/src/lib/cwt/rates.ts`:

```ts
// BIR ATC decision table for Ayala Land leasing context.
// Sources: RR 11-2018 (rent on real property), RR 2-98 §2.57.2.
export type ContractType = 'LEASE' | 'CONCESSION' | 'SERVICE'
export type TaxClassification = 'PRIVATE' | 'GOVT'

export interface AtcMatch {
  code: string
  ratePct: number
}

const TABLE: Record<ContractType, Record<TaxClassification, AtcMatch | null>> = {
  LEASE:      { PRIVATE: { code: 'WC100', ratePct: 5 }, GOVT: { code: 'WC640', ratePct: 5 } },
  SERVICE:    { PRIVATE: { code: 'WC158', ratePct: 2 }, GOVT: { code: 'WC640', ratePct: 5 } },
  CONCESSION: { PRIVATE: null,                            GOVT: null },
}

export function atcFor(input: { contractType: ContractType; taxClassification: TaxClassification }): AtcMatch | null {
  return TABLE[input.contractType][input.taxClassification]
}

export function defaultRateFor(contractType: ContractType): number {
  return TABLE[contractType].PRIVATE?.ratePct ?? 0
}
```

- [ ] **Step 4: Verify tests pass**

```bash
npm test -- rates
```

Expected: 7 tests pass.

- [ ] **Step 5: Commit**

```bash
git add app/src/lib/cwt/rates.ts app/src/lib/cwt/rates.test.ts
git commit -m "feat(cwt): add ATC rate decision table with tests"
```

### Task 1.3: 15-digit reference number (`lib/cwt/reference.ts`)

**Files:** Create `app/src/lib/cwt/reference.ts`, `app/src/lib/cwt/reference.test.ts`.

- [ ] **Step 1: Write the failing test**

Create `app/src/lib/cwt/reference.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { referenceNumberFor } from './reference'

describe('referenceNumberFor', () => {
  it('produces a 15-character string', () => {
    const r = referenceNumberFor({ year: 2026, month: 4, customerId: 10, invoiceId: 20, paymentId: 30 })
    expect(r).toHaveLength(15)
  })
  it('prefixes with YYYYMM', () => {
    const r = referenceNumberFor({ year: 2026, month: 4, customerId: 10, invoiceId: 20, paymentId: 30 })
    expect(r.slice(0, 6)).toBe('202604')
  })
  it('is deterministic for the same inputs', () => {
    const a = referenceNumberFor({ year: 2026, month: 4, customerId: 10, invoiceId: 20, paymentId: 30 })
    const b = referenceNumberFor({ year: 2026, month: 4, customerId: 10, invoiceId: 20, paymentId: 30 })
    expect(a).toBe(b)
  })
  it('differs across different inputs', () => {
    const a = referenceNumberFor({ year: 2026, month: 4, customerId: 10, invoiceId: 20, paymentId: 30 })
    const b = referenceNumberFor({ year: 2026, month: 4, customerId: 10, invoiceId: 20, paymentId: 31 })
    expect(a).not.toBe(b)
  })
  it('pads single-digit month', () => {
    const r = referenceNumberFor({ year: 2026, month: 1, customerId: 1, invoiceId: 1, paymentId: 1 })
    expect(r.slice(0, 6)).toBe('202601')
  })
})
```

- [ ] **Step 2: Run the test (expect failure)**

```bash
npm test -- reference
```

Expected: fails.

- [ ] **Step 3: Implement**

Create `app/src/lib/cwt/reference.ts`:

```ts
import { createHash } from 'node:crypto'

export interface ReferenceInput {
  year: number
  month: number
  customerId: number
  invoiceId: number
  paymentId: number
}

export function referenceNumberFor(input: ReferenceInput): string {
  const prefix = `${input.year.toString().padStart(4, '0')}${input.month.toString().padStart(2, '0')}`
  const seed = `${input.customerId}-${input.invoiceId}-${input.paymentId}`
  const hash = createHash('sha1').update(seed).digest('hex')
  const hashAsInt = BigInt('0x' + hash.slice(0, 16)) % BigInt(1_000_000_000)
  const tail = hashAsInt.toString().padStart(9, '0')
  return prefix + tail
}
```

- [ ] **Step 4: Verify tests pass**

```bash
npm test -- reference
```

Expected: 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add app/src/lib/cwt/reference.ts app/src/lib/cwt/reference.test.ts
git commit -m "feat(cwt): add 15-digit deterministic reference generator"
```

### Task 1.4: Gap detector (`lib/cwt/detector.ts`)

**Files:** Create `app/src/lib/cwt/detector.ts`, `app/src/lib/cwt/detector.test.ts`.

- [ ] **Step 1: Write the failing test**

Create `app/src/lib/cwt/detector.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { classifyPaymentGap } from './detector'

const baseInvoice = { amount: '100000.00', balanceRemaining: '100000.00' }

describe('classifyPaymentGap', () => {
  it('classifies a clean 5% short payment as CWT_MATCH', () => {
    expect(classifyPaymentGap({ invoice: baseInvoice, paymentAmount: '95000.00', declaredRatePct: '5.00' })).toMatchObject({
      kind: 'CWT_MATCH', gapAmount: 5000, gapPct: 5,
    })
  })
  it('classifies a 7% gap against a 5% declared rate as CWT_MISMATCH', () => {
    expect(classifyPaymentGap({ invoice: baseInvoice, paymentAmount: '93000.00', declaredRatePct: '5.00' }).kind).toBe('CWT_MISMATCH')
  })
  it('classifies a full payment as FULL', () => {
    expect(classifyPaymentGap({ invoice: baseInvoice, paymentAmount: '100000.00', declaredRatePct: '5.00' }).kind).toBe('FULL')
  })
  it('classifies a random underpayment (30%) as PARTIAL', () => {
    expect(classifyPaymentGap({ invoice: baseInvoice, paymentAmount: '70000.00', declaredRatePct: '5.00' }).kind).toBe('PARTIAL')
  })
  it('accepts ±0.5% tolerance on the declared rate', () => {
    // 5.4% is within 0.5pp of 5%
    expect(classifyPaymentGap({ invoice: baseInvoice, paymentAmount: '94600.00', declaredRatePct: '5.00' }).kind).toBe('CWT_MATCH')
  })
  it('returns NONE when no rate is declared', () => {
    expect(classifyPaymentGap({ invoice: baseInvoice, paymentAmount: '95000.00', declaredRatePct: null }).kind).toBe('NONE')
  })
})
```

- [ ] **Step 2: Run tests (expect failure)**

```bash
npm test -- detector
```

- [ ] **Step 3: Implement**

Create `app/src/lib/cwt/detector.ts`:

```ts
export type GapClassification =
  | { kind: 'CWT_MATCH'; gapAmount: number; gapPct: number }
  | { kind: 'CWT_MISMATCH'; gapAmount: number; gapPct: number; declaredRatePct: number }
  | { kind: 'FULL' }
  | { kind: 'PARTIAL'; gapAmount: number; gapPct: number }
  | { kind: 'NONE' }

export interface GapInput {
  invoice: { amount: string; balanceRemaining: string }
  paymentAmount: string
  declaredRatePct: string | null
}

const TOLERANCE_PP = 0.5       // ±0.5 percentage points
const FULL_EPSILON = 0.01      // ₱0.01 wiggle room

export function classifyPaymentGap({ invoice, paymentAmount, declaredRatePct }: GapInput): GapClassification {
  const invoiceAmount = Number(invoice.amount)
  const paid = Number(paymentAmount)
  const gap = Number(invoice.balanceRemaining) - paid

  if (Math.abs(gap) < FULL_EPSILON) return { kind: 'FULL' }

  const gapPct = (gap / invoiceAmount) * 100
  if (declaredRatePct === null) return { kind: 'NONE' }

  const rate = Number(declaredRatePct)
  if (Math.abs(gapPct - rate) <= TOLERANCE_PP) {
    return { kind: 'CWT_MATCH', gapAmount: round2(gap), gapPct: round2(gapPct) }
  }
  if (gapPct > 0 && gapPct < 15) {
    return { kind: 'CWT_MISMATCH', gapAmount: round2(gap), gapPct: round2(gapPct), declaredRatePct: rate }
  }
  return { kind: 'PARTIAL', gapAmount: round2(gap), gapPct: round2(gapPct) }
}

function round2(n: number): number { return Math.round(n * 100) / 100 }
```

- [ ] **Step 4: Verify tests pass**

```bash
npm test -- detector
```

Expected: 6 tests pass.

- [ ] **Step 5: Commit**

```bash
git add app/src/lib/cwt/detector.ts app/src/lib/cwt/detector.test.ts
git commit -m "feat(cwt): add payment-gap classifier with tolerance bands"
```

### Task 1.5: Extract BIR 2307 form field map

**Files:** Create `app/scripts/extract-2307-fields.ts`, generate `app/src/lib/cwt/pdf-fields.ts`.

- [ ] **Step 1: Write the extraction script**

Create `app/scripts/extract-2307-fields.ts`:

```ts
import { PDFDocument } from 'pdf-lib'
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

async function main() {
  const buf = await readFile(path.resolve(__dirname, '../public/forms/BIR-2307-fillable.pdf'))
  const doc = await PDFDocument.load(buf)
  const fields = doc.getForm().getFields().map(f => ({
    name: f.getName(),
    type: f.constructor.name,
  }))
  const output = `// AUTO-GENERATED by scripts/extract-2307-fields.ts\n` +
                 `export interface Bir2307Fields {\n` +
                 fields.map(f => `  ${JSON.stringify(f.name)}: ${tsTypeFor(f.type)}`).join('\n') +
                 `\n}\n\n` +
                 `export const BIR_2307_FIELD_NAMES = ${JSON.stringify(fields.map(f => f.name), null, 2)} as const\n`
  await writeFile(path.resolve(__dirname, '../src/lib/cwt/pdf-fields.ts'), output)
  console.log(`Extracted ${fields.length} fields`)
}

function tsTypeFor(type: string): string {
  if (type.includes('CheckBox') || type.includes('RadioGroup')) return 'boolean'
  return 'string'
}

main().catch(e => { console.error(e); process.exit(1) })
```

- [ ] **Step 2: Run extraction**

```bash
cd ~/projects/mpe-collections-demo/app
npm run gen:pdf-fields
```

Expected: "Extracted NN fields" where NN > 30. File `src/lib/cwt/pdf-fields.ts` is generated.

- [ ] **Step 3: Eyeball the generated map**

```bash
head -50 src/lib/cwt/pdf-fields.ts
```

Confirm it lists expected-looking BIR fields (payer name, payee TIN, withheld amount, ATC code, etc.). Field names from BIR's PDF are often named `TextField1`, `TextField2`, etc. — do not rename; use the numeric-ID mapping in Task 2.3.

- [ ] **Step 4: Commit both script and generated file**

```bash
git add app/scripts/extract-2307-fields.ts app/src/lib/cwt/pdf-fields.ts
git commit -m "feat(cwt): extract BIR 2307 fillable PDF field names"
```

### Task 1.6: PDF renderer (`lib/cwt/pdf.ts`)

**Files:** Create `app/src/lib/cwt/pdf.ts`, `app/src/lib/cwt/pdf-field-map.ts`.

- [ ] **Step 1: Map the business fields to PDF field IDs**

Open the BIR 2307 PDF in any PDF reader and note which AcroForm fields correspond to which business concepts. Create `app/src/lib/cwt/pdf-field-map.ts`:

```ts
// Hand-curated mapping from BIR 2307 AcroForm field IDs (as extracted by
// scripts/extract-2307-fields.ts) to the business fields the auto-issuance
// engine populates. If the template changes, re-run gen:pdf-fields and update
// this file. If a field ID does not exist in your template (BIR has revised
// the form several times), fall back to null and the renderer will skip it.
export const FIELD_MAP = {
  periodFromMMDDYYYY: 'TextField1',          // e.g. '04/01/2026'
  periodToMMDDYYYY:   'TextField2',
  payeeTIN:           'TextField3',
  payeeBranchCode:    'TextField4',
  payeeName:          'TextField5',
  payeeAddress:       'TextField6',
  payeeZipCode:       'TextField7',
  payorTIN:           'TextField8',
  payorBranchCode:    'TextField9',
  payorName:          'TextField10',
  payorAddress:       'TextField11',
  payorZipCode:       'TextField12',
  atcCode:            'TextField20',
  grossAmount:        'TextField30',
  taxWithheldAmount:  'TextField31',
  // Signature-box target coordinates (pt from page bottom-left, single-page form)
  signatureX: 380, signatureY: 120, signatureW: 150, signatureH: 40,
  signedByNameField:  'TextField40',
  signedByTinField:   'TextField41',
} as const
```

NOTE: the `TextFieldN` IDs shown are placeholders. After running `gen:pdf-fields` (Task 1.5), substitute the real IDs by reading `pdf-fields.ts` and aligning with the form visually. If a specific field ID is missing, set that key to `null` and document the skip.

- [ ] **Step 2: Write the renderer**

Create `app/src/lib/cwt/pdf.ts`:

```ts
import { PDFDocument, PDFTextField, rgb } from 'pdf-lib'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { FIELD_MAP } from './pdf-field-map'

const TEMPLATE_PATH = path.resolve(process.cwd(), 'public/forms/BIR-2307-fillable.pdf')

export interface Bir2307Data {
  periodStart: string          // YYYY-MM-DD
  periodEnd: string
  payeeTin: string             // Ayala Land
  payeeBranchCode: string
  payeeName: string
  payeeAddress: string
  payeeZipCode: string
  payorTin: string             // Tenant
  payorBranchCode: string
  payorName: string
  payorAddress: string
  payorZipCode: string
  atcCode: string
  grossAmount: number
  taxWithheldAmount: number
  signedByName: string
  signedByTin: string
  signatureImagePngBase64?: string
}

export async function renderBir2307Pdf(data: Bir2307Data): Promise<Uint8Array> {
  const templateBytes = await readFile(TEMPLATE_PATH)
  const pdfDoc = await PDFDocument.load(templateBytes)
  const form = pdfDoc.getForm()

  const set = (key: keyof typeof FIELD_MAP, value: string) => {
    const fieldId = FIELD_MAP[key]
    if (!fieldId || typeof fieldId !== 'string') return
    try {
      const f = form.getField(fieldId) as PDFTextField
      f.setText(value)
    } catch { /* field missing in this template revision — skip */ }
  }

  set('periodFromMMDDYYYY', mmddyyyy(data.periodStart))
  set('periodToMMDDYYYY',   mmddyyyy(data.periodEnd))
  set('payeeTIN',           data.payeeTin)
  set('payeeBranchCode',    data.payeeBranchCode)
  set('payeeName',          data.payeeName)
  set('payeeAddress',       data.payeeAddress)
  set('payeeZipCode',       data.payeeZipCode)
  set('payorTIN',           data.payorTin)
  set('payorBranchCode',    data.payorBranchCode)
  set('payorName',          data.payorName)
  set('payorAddress',       data.payorAddress)
  set('payorZipCode',       data.payorZipCode)
  set('atcCode',            data.atcCode)
  set('grossAmount',        data.grossAmount.toFixed(2))
  set('taxWithheldAmount',  data.taxWithheldAmount.toFixed(2))
  set('signedByNameField',  data.signedByName)
  set('signedByTinField',   data.signedByTin)

  if (data.signatureImagePngBase64) {
    const sig = await pdfDoc.embedPng(Buffer.from(data.signatureImagePngBase64, 'base64'))
    const page = pdfDoc.getPages()[0]
    page.drawImage(sig, {
      x: FIELD_MAP.signatureX,
      y: FIELD_MAP.signatureY,
      width: FIELD_MAP.signatureW,
      height: FIELD_MAP.signatureH,
    })
  }

  form.flatten()
  return await pdfDoc.save()
}

function mmddyyyy(isoDate: string): string {
  const [y, m, d] = isoDate.split('-')
  return `${m}/${d}/${y}`
}
```

- [ ] **Step 3: Manually verify the output**

Write a small ad-hoc script and run it:

```bash
cat > /tmp/test-pdf.ts <<'EOF'
import { renderBir2307Pdf } from './src/lib/cwt/pdf'
import { writeFile } from 'node:fs/promises'
async function main() {
  const bytes = await renderBir2307Pdf({
    periodStart: '2026-04-01', periodEnd: '2026-04-30',
    payeeTin: '000-111-222-000', payeeBranchCode: '000', payeeName: 'Ayala Land Inc.',
    payeeAddress: 'Makati City', payeeZipCode: '1226',
    payorTin: '333-444-555-000', payorBranchCode: '000', payorName: 'ABC Corp',
    payorAddress: 'BGC Taguig', payorZipCode: '1634',
    atcCode: 'WC100', grossAmount: 100000, taxWithheldAmount: 5000,
    signedByName: 'Juan Dela Cruz', signedByTin: '333-444-555-000',
  })
  await writeFile('/tmp/sample-2307.pdf', bytes)
  console.log('wrote /tmp/sample-2307.pdf', bytes.length, 'bytes')
}
main()
EOF
npx tsx /tmp/test-pdf.ts
```

Expected: file written, open in a PDF reader, verify the six required groups populate: period, payee, payor, ATC, amounts, signed-by. If a specific field is blank in the output, adjust `FIELD_MAP` to the correct AcroForm ID.

- [ ] **Step 4: Commit**

```bash
git add app/src/lib/cwt/pdf.ts app/src/lib/cwt/pdf-field-map.ts
git commit -m "feat(cwt): render BIR 2307 from fillable PDF template"
```

### Task 1.7: QAP CSV builder (`lib/cwt/qap.ts`)

**Files:** Create `app/src/lib/cwt/qap.ts`, `app/src/lib/cwt/qap.test.ts`.

- [ ] **Step 1: Write failing test**

Create `app/src/lib/cwt/qap.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { buildQapCsv } from './qap'

describe('buildQapCsv', () => {
  const certs = [
    { atcCode: 'WC100', payorTin: '111', payorBranchCode: '000', payorName: 'A Corp',
      grossAmount: '100000.00', withheldAmount: '5000.00', periodEnd: '2026-04-30', referenceNumber: '202604000000001' },
    { atcCode: 'WC100', payorTin: '222', payorBranchCode: '000', payorName: 'B Corp',
      grossAmount: '50000.00',  withheldAmount: '2500.00', periodEnd: '2026-04-30', referenceNumber: '202604000000002' },
    { atcCode: 'WC158', payorTin: '333', payorBranchCode: '000', payorName: 'C Corp',
      grossAmount: '30000.00',  withheldAmount: '600.00',  periodEnd: '2026-04-30', referenceNumber: '202604000000003' },
  ]
  it('emits one header row + one data row per cert', () => {
    const csv = buildQapCsv(certs)
    const lines = csv.split('\n').filter(Boolean)
    expect(lines).toHaveLength(4)
    expect(lines[0]).toContain('ATC')
  })
  it('groups totals per ATC in the last line', () => {
    const csv = buildQapCsv(certs)
    expect(csv).toContain('7500.00')  // WC100 total
    expect(csv).toContain('600.00')   // WC158 total
  })
})
```

- [ ] **Step 2: Run test (expect failure)**

```bash
npm test -- qap
```

- [ ] **Step 3: Implement**

Create `app/src/lib/cwt/qap.ts`:

```ts
export interface QapRow {
  atcCode: string
  payorTin: string
  payorBranchCode: string
  payorName: string
  grossAmount: string
  withheldAmount: string
  periodEnd: string
  referenceNumber: string
}

const HEADER = ['ATC', 'PayorTIN', 'PayorBranch', 'PayorName', 'Gross', 'TaxWithheld', 'Period', 'RefNo']

export function buildQapCsv(rows: QapRow[]): string {
  const lines = [HEADER.join(',')]
  for (const r of rows) {
    lines.push([r.atcCode, r.payorTin, r.payorBranchCode, csvEscape(r.payorName),
                r.grossAmount, r.withheldAmount, r.periodEnd, r.referenceNumber].join(','))
  }
  const byAtc = rows.reduce<Record<string, number>>((acc, r) => {
    acc[r.atcCode] = (acc[r.atcCode] ?? 0) + Number(r.withheldAmount)
    return acc
  }, {})
  for (const [atc, total] of Object.entries(byAtc)) {
    lines.push(['TOTAL', atc, '', '', '', total.toFixed(2), '', ''].join(','))
  }
  return lines.join('\n') + '\n'
}

function csvEscape(s: string): string {
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}
```

- [ ] **Step 4: Verify**

```bash
npm test -- qap
```

Expected: 2 tests pass.

- [ ] **Step 5: Commit**

```bash
git add app/src/lib/cwt/qap.ts app/src/lib/cwt/qap.test.ts
git commit -m "feat(cwt): add QAP CSV builder with per-ATC totals"
```

---

## Phase 2 — Signatures + seed data

### Task 2.1: Signature PNG generator

**Files:** Create `app/scripts/generate-signatures.ts`, output `app/public/signatures/demo-sig-{1..8}.png`.

- [ ] **Step 1: Write the generator**

Create `app/scripts/generate-signatures.ts`:

```ts
import satori from 'satori'
import { Resvg } from '@resvg/resvg-js'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import path from 'node:path'

const SIGNATORIES = [
  'Juan Dela Cruz', 'Maria Santos', 'Jose Reyes', 'Ana Garcia',
  'Roberto Tan', 'Lucia Lim', 'Eduardo Cruz', 'Isabella Reyes',
]

async function main() {
  const outDir = path.resolve(__dirname, '../public/signatures')
  await mkdir(outDir, { recursive: true })

  const fontBytes = await readFile(path.resolve(__dirname, './Caveat-Regular.ttf'))

  for (let i = 0; i < SIGNATORIES.length; i++) {
    const svg = await satori(
      {
        type: 'div',
        props: {
          style: {
            display: 'flex', width: '400px', height: '120px',
            alignItems: 'center', justifyContent: 'center',
            fontFamily: 'Caveat', fontSize: 64, color: '#0b2545',
          },
          children: SIGNATORIES[i],
        },
      },
      { width: 400, height: 120, fonts: [{ name: 'Caveat', data: fontBytes, weight: 400, style: 'normal' }] }
    )
    const png = new Resvg(svg, { fitTo: { mode: 'width', value: 400 } }).render().asPng()
    await writeFile(path.join(outDir, `demo-sig-${i + 1}.png`), png)
    console.log(`generated demo-sig-${i + 1}.png`)
  }
}

main().catch(e => { console.error(e); process.exit(1) })
```

- [ ] **Step 2: Download the Caveat handwriting font**

```bash
mkdir -p ~/projects/mpe-collections-demo/app/scripts
curl -L -o ~/projects/mpe-collections-demo/app/scripts/Caveat-Regular.ttf \
  "https://github.com/google/fonts/raw/main/ofl/caveat/Caveat%5Bwght%5D.ttf"
```

- [ ] **Step 3: Run the generator**

```bash
cd ~/projects/mpe-collections-demo/app && npm run gen:signatures
```

Expected: 8 PNG files in `public/signatures/`.

- [ ] **Step 4: Commit**

```bash
git add app/scripts/generate-signatures.ts app/scripts/Caveat-Regular.ttf app/public/signatures/
git commit -m "feat(cwt): generate demo signature PNGs via Satori"
```

### Task 2.2: Extend seed data — enrolled corporate tenants

**Files:** Modify `app/src/lib/seed.ts`.

- [ ] **Step 1: Add CWT tenant seed data to the end of `seedDatabase()`**

Open `app/src/lib/seed.ts`. At the end of the function, just before the final summary log, insert a new section:

```ts
// ─── CWT ENROLLMENT LAYER ────────────────────────────────────────────────
// Upgrade 9 tenants to corporate lessees subject to CWT; 7 enrolled, 3 non-enrolled.
// The "about-to-pay" tenant is reserved for the live magic-moment demo.

const allCustomers = await db.select().from(customers)
const corpTenants = allCustomers.filter(c => c.type === 'TENANT').slice(0, 11)

const enrolledIds: number[] = []
for (let i = 0; i < 8; i++) {
  const c = corpTenants[i]
  const tin = `${randInt(100, 999)}-${randInt(100, 999)}-${randInt(100, 999)}-000`
  const sigUrl = `/signatures/demo-sig-${i + 1}.png`
  await db.update(customers).set({
    tin,
    branchCode: '000',
    rdoCode: String(randInt(40, 60)),
    taxClassification: 'PRIVATE',
    isTopWithholdingAgent: i === 0,
    authorizedSignatoryName: ['Juan Dela Cruz','Maria Santos','Jose Reyes','Ana Garcia',
                              'Roberto Tan','Lucia Lim','Eduardo Cruz','Isabella Reyes'][i],
    authorizedSignatoryEmail: `signatory${i + 1}@${c.name.toLowerCase().replace(/\s+/g,'')}.com.ph`,
    signatureImageUrl: sigUrl,
    withholdingRatePct: '5.00',
    cwtAtcCode: 'WC100',
    cwtAutoIssueEnrolledAt: new Date(Date.now() - randInt(30, 180) * 86400000),
  }).where(eq(customers.customerId, c.customerId))
  enrolledIds.push(c.customerId)
}

// Mark tenant #8 as the "reserved magic-moment tenant" via a well-known name suffix
await db.update(customers).set({ name: corpTenants[7].name + ' (Demo Corp)' })
  .where(eq(customers.customerId, corpTenants[7].customerId))

// The remaining 3 corpTenants[8..10] stay non-enrolled (no TIN set yet, we still
// want 2 of them to have emailed-2307 fixtures — that's handled in Task 4.2).

console.log(`Enrolled ${enrolledIds.length} corporate tenants for CWT auto-issuance`)
```

- [ ] **Step 2: Add historical CWT certificate seeding**

Immediately after the enrollment loop, add:

```ts
// For each enrolled tenant except #8 (reserved), seed past 3 months of issued
// certificates against their closed invoices that were short-paid.
import { referenceNumberFor } from './cwt/reference'
const cwtRows: any[] = []
for (const customerId of enrolledIds.slice(0, 7)) {
  const tenantInvoices = await db.select().from(invoices).where(eq(invoices.customerId, customerId)).limit(3)
  for (const inv of tenantInvoices) {
    const gross = Number(inv.amount)
    const withheld = Math.round(gross * 5) / 100
    const payment = (await db.select().from(incomingPayments)
      .where(eq(incomingPayments.invoiceId, inv.invoiceId)).limit(1))[0]
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
      pdfUrl: null,  // generated lazily by the engine when clicked in the UI
      signatureApplied: true, status: 'ISSUED', source: 'AUTO_ENROLLED',
      signedByName: 'Auto', signedByEmail: 'auto@ayalaland.com',
      issuedAt: payment.paymentDate,
    })
  }
}
await chunkedInsert(schema.cwtCertificates, cwtRows)
console.log(`Seeded ${cwtRows.length} historical CWT certificates`)

// Seed one anomaly on tenant[8] (reserved) — a short-by-7% payment → ESCALATED
// This is referenced by slide 8 (intelligence layer).
// (Anomaly seeding lives here so the screenshot script can rely on its presence.)
```

- [ ] **Step 3: Run seed**

```bash
curl -s -X POST http://localhost:3000/api/seed
```

Expected: log lines show "Enrolled 8 corporate tenants" and "Seeded ~21 historical CWT certificates".

- [ ] **Step 4: Commit**

```bash
git add app/src/lib/seed.ts
git commit -m "feat(seed): add CWT enrollment + historical certificate seeding"
```

---

## Phase 3 — Tenant enrollment

### Task 3.1: Enrollment API route

**Files:** Create `app/src/app/api/cwt/enroll/route.ts`.

- [ ] **Step 1: Implement the endpoint**

Create `app/src/app/api/cwt/enroll/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { customers, documents } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { verifyQrToken } from '@/lib/jwt'

interface EnrollPayload {
  customerId: number
  qrToken: string
  tin: string
  branchCode: string
  rdoCode: string
  companyAddress: string
  zipCode: string
  taxClassification: 'PRIVATE' | 'GOVT'
  signatoryName: string
  signatoryEmail: string
  signatureDataUrl: string  // data:image/png;base64,...
  tinProofDataUrl: string   // data:application/pdf;base64,...
  consents: { accurate: boolean; disclose: boolean; alerts: boolean; dpa: boolean; authorize: boolean }
}

export async function POST(req: NextRequest) {
  const payload = await req.json() as EnrollPayload
  try { verifyQrToken(payload.qrToken) } catch {
    return NextResponse.json({ error: 'invalid QR token' }, { status: 401 })
  }
  const required = ['accurate', 'disclose', 'dpa', 'authorize'] as const
  if (required.some(k => !payload.consents[k])) {
    return NextResponse.json({ error: 'missing required consent' }, { status: 400 })
  }

  // Store signature + TIN proof + signed authorization letter (stub) in documents_col
  const [sigDoc] = await db.insert(documents).values({
    customerId: payload.customerId,
    fileUrl: payload.signatureDataUrl,
    fileName: `signature-${payload.customerId}.png`,
    fileType: 'image/png',
    ocrStatus: 'SKIPPED',
  }).returning()
  const [tinDoc] = await db.insert(documents).values({
    customerId: payload.customerId,
    fileUrl: payload.tinProofDataUrl,
    fileName: `tin-proof-${payload.customerId}.pdf`,
    fileType: 'application/pdf',
    ocrStatus: 'PENDING',
  }).returning()

  await db.update(customers).set({
    tin: payload.tin, branchCode: payload.branchCode, rdoCode: payload.rdoCode,
    taxClassification: payload.taxClassification,
    authorizedSignatoryName: payload.signatoryName,
    authorizedSignatoryEmail: payload.signatoryEmail,
    signatureImageUrl: sigDoc.fileUrl,
    withholdingRatePct: '5.00', cwtAtcCode: 'WC100',
    cwtAutoIssueEnrolledAt: new Date(),
    cwtAuthorizationDocumentId: tinDoc.documentId,
  }).where(eq(customers.customerId, payload.customerId))

  return NextResponse.json({ ok: true, customerId: payload.customerId })
}
```

- [ ] **Step 2: Smoke-test**

```bash
cd ~/projects/mpe-collections-demo/app && npm run dev &
sleep 5
# Get a QR token for an existing customer (use existing /api/qr route)
# Then POST a minimal payload:
curl -s -X POST http://localhost:3000/api/cwt/enroll \
  -H "Content-Type: application/json" \
  -d '{ "customerId": 9, "qrToken": "...", "tin":"999-888-777-000", "branchCode":"000", "rdoCode":"50", "companyAddress":"BGC", "zipCode":"1634", "taxClassification":"PRIVATE", "signatoryName":"Test Signatory", "signatoryEmail":"t@example.com", "signatureDataUrl":"data:image/png;base64,iVBORw0K...", "tinProofDataUrl":"data:application/pdf;base64,JVBERi0xLjQK...", "consents":{"accurate":true,"disclose":true,"alerts":true,"dpa":true,"authorize":true} }'
```

Expected: `{"ok":true,"customerId":9}` and DB updates visible.

- [ ] **Step 3: Commit**

```bash
git add app/src/app/api/cwt/enroll/route.ts
git commit -m "feat(cwt): enrollment API with consent validation"
```

### Task 3.2: Enrollment UI

**Files:** Create `app/src/app/pay/enroll/page.tsx`, `app/src/app/pay/enroll/success/page.tsx`, `app/src/components/cwt/EnrollmentForm.tsx`, `app/src/components/cwt/SignaturePad.tsx`.

- [ ] **Step 1: Build the signature pad**

Create `app/src/components/cwt/SignaturePad.tsx`:

```tsx
'use client'
import { useRef, useState, useEffect } from 'react'

export function SignaturePad({ onChange }: { onChange: (dataUrl: string | null) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [drawing, setDrawing] = useState(false)
  const [hasInk, setHasInk] = useState(false)

  useEffect(() => {
    const c = canvasRef.current!
    const ctx = c.getContext('2d')!
    ctx.lineWidth = 2
    ctx.strokeStyle = '#0b2545'
  }, [])

  const pos = (e: React.PointerEvent) => {
    const c = canvasRef.current!
    const r = c.getBoundingClientRect()
    return { x: ((e.clientX - r.left) / r.width) * c.width, y: ((e.clientY - r.top) / r.height) * c.height }
  }
  const start = (e: React.PointerEvent) => { setDrawing(true); const {x,y} = pos(e); canvasRef.current!.getContext('2d')!.beginPath(); canvasRef.current!.getContext('2d')!.moveTo(x,y) }
  const move = (e: React.PointerEvent) => {
    if (!drawing) return
    const {x,y} = pos(e); const ctx = canvasRef.current!.getContext('2d')!
    ctx.lineTo(x,y); ctx.stroke(); setHasInk(true)
  }
  const end = () => {
    setDrawing(false)
    if (!hasInk) return
    onChange(canvasRef.current!.toDataURL('image/png'))
  }
  const clear = () => {
    const c = canvasRef.current!; c.getContext('2d')!.clearRect(0,0,c.width,c.height); setHasInk(false); onChange(null)
  }

  return (
    <div className="space-y-2">
      <canvas ref={canvasRef} width={480} height={140}
        className="w-full border border-slate-300 rounded bg-white cursor-crosshair"
        onPointerDown={start} onPointerMove={move} onPointerUp={end} onPointerLeave={end} />
      <button type="button" onClick={clear} className="text-sm text-slate-500 hover:text-slate-900">Clear</button>
    </div>
  )
}
```

- [ ] **Step 2: Build the form component**

Create `app/src/components/cwt/EnrollmentForm.tsx`:

```tsx
'use client'
import { useState } from 'react'
import { SignaturePad } from './SignaturePad'
import { useRouter, useSearchParams } from 'next/navigation'

export function EnrollmentForm({ customerId, qrToken }: { customerId: number; qrToken: string }) {
  const router = useRouter()
  const [state, setState] = useState({
    tin: '', branchCode: '000', rdoCode: '',
    companyAddress: '', zipCode: '',
    taxClassification: 'PRIVATE' as 'PRIVATE' | 'GOVT',
    signatoryName: '', signatoryEmail: '',
    signatureDataUrl: null as string | null,
    tinProofDataUrl: null as string | null,
    consents: { accurate: false, disclose: false, alerts: false, dpa: false, authorize: false },
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const readFile = (f: File) => new Promise<string>(res => {
    const r = new FileReader(); r.onload = () => res(r.result as string); r.readAsDataURL(f)
  })

  const submit = async () => {
    setSubmitting(true); setError(null)
    try {
      const res = await fetch('/api/cwt/enroll', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId, qrToken, ...state }),
      })
      if (!res.ok) throw new Error((await res.json()).error ?? 'failed')
      router.push(`/pay/enroll/success?customerId=${customerId}`)
    } catch (e: any) { setError(e.message) } finally { setSubmitting(false) }
  }

  const allReqConsents = state.consents.accurate && state.consents.disclose && state.consents.dpa && state.consents.authorize

  return (
    <form onSubmit={e => { e.preventDefault(); submit() }} className="max-w-2xl mx-auto py-10 space-y-8">
      <section>
        <h2 className="text-xl font-semibold">Company information</h2>
        <div className="grid grid-cols-2 gap-3 mt-4">
          <input required placeholder="TIN (###-###-###-###)" value={state.tin}
            onChange={e => setState(s => ({ ...s, tin: e.target.value }))} className="input" />
          <input required placeholder="Branch code" value={state.branchCode}
            onChange={e => setState(s => ({ ...s, branchCode: e.target.value }))} className="input" />
          <input required placeholder="RDO code" value={state.rdoCode}
            onChange={e => setState(s => ({ ...s, rdoCode: e.target.value }))} className="input" />
          <select value={state.taxClassification}
            onChange={e => setState(s => ({ ...s, taxClassification: e.target.value as any }))} className="input">
            <option value="PRIVATE">Private</option><option value="GOVT">Government</option>
          </select>
          <input required placeholder="Registered address" value={state.companyAddress}
            onChange={e => setState(s => ({ ...s, companyAddress: e.target.value }))} className="input col-span-2" />
          <input required placeholder="ZIP code" value={state.zipCode}
            onChange={e => setState(s => ({ ...s, zipCode: e.target.value }))} className="input" />
        </div>
      </section>

      <section>
        <h2 className="text-xl font-semibold">Proof of TIN</h2>
        <p className="text-sm text-slate-500 mb-2">Upload BIR Form 2303 or a sample OR (PDF/PNG/JPEG, ≤ 5 MB).</p>
        <input type="file" accept="application/pdf,image/png,image/jpeg"
          onChange={async e => { const f = e.target.files?.[0]; if (f) setState(s => ({ ...s, tinProofDataUrl: await readFile(f) })) }} />
      </section>

      <section>
        <h2 className="text-xl font-semibold">Authorized signatory</h2>
        <div className="grid grid-cols-2 gap-3 mt-4">
          <input required placeholder="Name" value={state.signatoryName}
            onChange={e => setState(s => ({ ...s, signatoryName: e.target.value }))} className="input" />
          <input required type="email" placeholder="Email" value={state.signatoryEmail}
            onChange={e => setState(s => ({ ...s, signatoryEmail: e.target.value }))} className="input" />
        </div>
        <div className="mt-3">
          <label className="text-sm text-slate-600">Signature (sign below)</label>
          <SignaturePad onChange={dataUrl => setState(s => ({ ...s, signatureDataUrl: dataUrl }))} />
        </div>
      </section>

      <section>
        <h2 className="text-xl font-semibold">Declarations</h2>
        {[
          ['accurate', 'The information above is accurate and submitted voluntarily.'],
          ['disclose', 'We permit Ayala Land to disclose our data to its subsidiaries for portal access.'],
          ['alerts',   'We authorize email and SMS alerts regarding portal updates.'],
          ['dpa',      'We consent to data collection under the Data Privacy Act of 2012 and Ayala Land’s privacy policy.'],
          ['authorize','We authorize Ayala Land’s portal to generate, electronically sign with our stored signature, and deliver BIR Form 2307 on our behalf, in compliance with RA 8792 and RR 16-2021.'],
        ].map(([k, text]) => (
          <label key={k} className="flex items-start gap-2 mt-2">
            <input type="checkbox" className="mt-1"
              checked={(state.consents as any)[k]}
              onChange={e => setState(s => ({ ...s, consents: { ...s.consents, [k]: e.target.checked } }))} />
            <span className="text-sm">{text}</span>
          </label>
        ))}
      </section>

      {error && <div className="text-red-600 text-sm">{error}</div>}
      <button type="submit" disabled={!allReqConsents || !state.signatureDataUrl || !state.tinProofDataUrl || submitting}
        className="btn-primary w-full">
        {submitting ? 'Submitting...' : 'Enroll'}
      </button>
    </form>
  )
}
```

- [ ] **Step 3: Build the pages**

Create `app/src/app/pay/enroll/page.tsx`:

```tsx
import { EnrollmentForm } from '@/components/cwt/EnrollmentForm'

export default function Page({ searchParams }: { searchParams: Promise<{ customerId?: string; token?: string }> }) {
  return <EnrollmentForm {...(async () => {
    const sp = await searchParams
    return { customerId: Number(sp.customerId), qrToken: sp.token ?? '' }
  })() as any} />
}
```

Create `app/src/app/pay/enroll/success/page.tsx`:

```tsx
export default function Page() {
  return (
    <div className="max-w-xl mx-auto py-16 text-center space-y-4">
      <h1 className="text-2xl font-semibold">Enrolled ✓</h1>
      <p className="text-slate-600">Future rent payments will automatically trigger BIR 2307 issuance on your behalf. Certificates will be emailed to your authorized signatory.</p>
    </div>
  )
}
```

- [ ] **Step 4: Manual verification**

Run `npm run dev`, visit `http://localhost:3000/pay/enroll?customerId=10&token=<valid>`, fill the form, draw a signature, tick all required consents, submit, verify redirect to the success page and DB row updated.

- [ ] **Step 5: Commit**

```bash
git add app/src/app/pay/enroll/ app/src/components/cwt/
git commit -m "feat(cwt): tenant enrollment page + signature pad"
```

---

## Phase 4 — Auto-issuance engine

### Task 4.1: Inline auto-issue hook + cron route

**Files:** Create `app/src/lib/cwt/issue.ts`, `app/src/app/api/cron/generate-cwt/route.ts`; modify wherever `incomingPayments.insert(...)` happens to also call the hook.

- [ ] **Step 1: Core issuance function**

Create `app/src/lib/cwt/issue.ts`:

```ts
import { db } from '@/db'
import { customers, incomingPayments, invoices, cwtCertificates, documents, escalations } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { classifyPaymentGap } from './detector'
import { renderBir2307Pdf } from './pdf'
import { referenceNumberFor } from './reference'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

const AYALA_PAYEE = {
  tin: '000-000-000-000', branchCode: '000',
  name: 'Ayala Land, Inc.', address: 'Tower One, Ayala Triangle, Makati City',
  zipCode: '1226',
}

export async function tryAutoIssueForPayment(paymentId: number): Promise<
  { issued: true; certificateId: number; referenceNumber: string } |
  { issued: false; reason: string }
> {
  const [payment] = await db.select().from(incomingPayments).where(eq(incomingPayments.paymentId, paymentId))
  if (!payment || payment.cwtCertificateId) return { issued: false, reason: 'already processed' }

  const [invoice] = await db.select().from(invoices).where(eq(invoices.invoiceId, payment.invoiceId!))
  if (!invoice) return { issued: false, reason: 'no invoice' }
  const [customer] = await db.select().from(customers).where(eq(customers.customerId, payment.customerId))
  if (!customer?.cwtAutoIssueEnrolledAt) return { issued: false, reason: 'not enrolled' }

  const cls = classifyPaymentGap({
    invoice: { amount: invoice.amount, balanceRemaining: invoice.balanceRemaining },
    paymentAmount: payment.amount,
    declaredRatePct: customer.withholdingRatePct,
  })

  if (cls.kind === 'CWT_MISMATCH') {
    await db.insert(escalations).values({
      documentId: 0, customerId: customer.customerId,
      escalationType: 'CWT_GAP_MISMATCH',
      description: `Expected ${customer.withholdingRatePct}%, observed ${cls.gapPct}% on INV-${invoice.invoiceNumber}`,
      status: 'OPEN',
    } as any)
    return { issued: false, reason: 'mismatch escalated' }
  }
  if (cls.kind !== 'CWT_MATCH') return { issued: false, reason: `gap classification: ${cls.kind}` }

  const period = new Date(invoice.billingPeriodStart)
  const ref = referenceNumberFor({
    year: period.getFullYear(), month: period.getMonth() + 1,
    customerId: customer.customerId, invoiceId: invoice.invoiceId, paymentId: payment.paymentId,
  })

  // Render PDF
  let signatureB64: string | undefined
  if (customer.signatureImageUrl) {
    try {
      const sigPath = customer.signatureImageUrl.startsWith('data:')
        ? null
        : path.resolve(process.cwd(), 'public' + customer.signatureImageUrl)
      if (sigPath) signatureB64 = (await readFile(sigPath)).toString('base64')
      else signatureB64 = customer.signatureImageUrl.split(',')[1]
    } catch { /* soldier on */ }
  }

  const pdfBytes = await renderBir2307Pdf({
    periodStart: invoice.billingPeriodStart, periodEnd: invoice.billingPeriodEnd,
    payeeTin: AYALA_PAYEE.tin, payeeBranchCode: AYALA_PAYEE.branchCode,
    payeeName: AYALA_PAYEE.name, payeeAddress: AYALA_PAYEE.address, payeeZipCode: AYALA_PAYEE.zipCode,
    payorTin: customer.tin!, payorBranchCode: customer.branchCode ?? '000',
    payorName: customer.name, payorAddress: customer.unitInfo ?? '', payorZipCode: '0000',
    atcCode: customer.cwtAtcCode ?? 'WC100',
    grossAmount: Number(invoice.amount), taxWithheldAmount: cls.gapAmount,
    signedByName: customer.authorizedSignatoryName ?? 'Auto',
    signedByTin: customer.tin!,
    signatureImagePngBase64: signatureB64,
  })
  const pdfDataUrl = `data:application/pdf;base64,${Buffer.from(pdfBytes).toString('base64')}`

  // Write certificate
  const [cert] = await db.insert(cwtCertificates).values({
    customerId: customer.customerId, contractId: invoice.contractId, invoiceId: invoice.invoiceId,
    paymentId: payment.paymentId,
    grossAmount: invoice.amount, withheldAmount: cls.gapAmount.toFixed(2),
    ratePct: customer.withholdingRatePct!, atcCode: customer.cwtAtcCode!,
    periodStart: invoice.billingPeriodStart, periodEnd: invoice.billingPeriodEnd,
    referenceNumber: ref, pdfUrl: pdfDataUrl, signatureApplied: !!signatureB64,
    status: 'ISSUED', source: 'AUTO_ENROLLED',
    signedByName: customer.authorizedSignatoryName, signedByEmail: customer.authorizedSignatoryEmail,
    issuedAt: new Date(),
  }).returning()

  // Link certificate back to payment + synthesize CWT payment + close invoice
  await db.update(incomingPayments).set({
    cwtAmount: cls.gapAmount.toFixed(2), cwtCertificateId: cert.certificateId,
  }).where(eq(incomingPayments.paymentId, payment.paymentId))

  await db.insert(incomingPayments).values({
    invoiceId: invoice.invoiceId, customerId: customer.customerId,
    amount: cls.gapAmount.toFixed(2), paymentMethod: 'CWT',
    referenceNumber: ref, status: 'CONFIRMED', confirmedAt: new Date(),
    cwtCertificateId: cert.certificateId,
  } as any)

  const newBalance = Math.max(0, Number(invoice.balanceRemaining) - Number(payment.amount) - cls.gapAmount)
  await db.update(invoices).set({
    balanceRemaining: newBalance.toFixed(2),
    status: newBalance < 0.01 ? 'PAID' : invoice.status,
  }).where(eq(invoices.invoiceId, invoice.invoiceId))

  return { issued: true, certificateId: cert.certificateId, referenceNumber: ref }
}
```

- [ ] **Step 2: Wire inline trigger**

Search for `incomingPayments).values(` in `app/src/app/api/` to find every place the app writes incoming payments. For each that is a real tenant-rent payment (not the synthetic CWT one) append this after insert:

```ts
import { tryAutoIssueForPayment } from '@/lib/cwt/issue'
// ... after db.insert(incomingPayments)... returning()
await tryAutoIssueForPayment(insertedRow.paymentId)
```

Guard against infinite recursion — the CWT synthetic row is inserted with `paymentMethod: 'CWT'` and `tryAutoIssueForPayment` already short-circuits via the `cwtCertificateId` already-set check, so no extra guard is needed.

- [ ] **Step 3: Cron route**

Create `app/src/app/api/cron/generate-cwt/route.ts`:

```ts
import { NextResponse } from 'next/server'
import { db } from '@/db'
import { incomingPayments } from '@/db/schema'
import { isNull, and, eq, ne } from 'drizzle-orm'
import { tryAutoIssueForPayment } from '@/lib/cwt/issue'

export async function POST() {
  const pending = await db.select().from(incomingPayments).where(
    and(isNull(incomingPayments.cwtCertificateId), ne(incomingPayments.paymentMethod, 'CWT'))
  ).limit(50)
  const results: any[] = []
  for (const p of pending) {
    results.push({ paymentId: p.paymentId, ...(await tryAutoIssueForPayment(p.paymentId)) })
  }
  return NextResponse.json({ processed: results.length, results })
}
```

- [ ] **Step 4: Register cron**

Open `vercel.json`, add to the `crons` array:

```json
{ "path": "/api/cron/generate-cwt", "schedule": "0 1 * * *" }
```

- [ ] **Step 5: Smoke-test the engine**

Run the server, seed, then manually insert a short payment against a known enrolled tenant's open invoice and verify a certificate appears:

```bash
cd ~/projects/mpe-collections-demo/app && npm run dev &
sleep 5
curl -X POST http://localhost:3000/api/cron/generate-cwt
```

Expected: JSON response listing one-or-more processed payments with `issued: true` or a skip reason.

- [ ] **Step 6: Commit**

```bash
git add app/src/lib/cwt/issue.ts app/src/app/api/cron/generate-cwt app/vercel.json
git commit -m "feat(cwt): auto-issuance engine (inline + cron)"
```

### Task 4.2: Simulate-CWT-payment demo endpoint

**Files:** Create `app/src/app/api/demo/simulate-cwt-payment/route.ts`.

- [ ] **Step 1: Implement**

Create `app/src/app/api/demo/simulate-cwt-payment/route.ts`:

```ts
import { NextResponse } from 'next/server'
import { db } from '@/db'
import { customers, invoices, incomingPayments } from '@/db/schema'
import { and, eq, like } from 'drizzle-orm'
import { tryAutoIssueForPayment } from '@/lib/cwt/issue'

// POST /api/demo/simulate-cwt-payment
// Writes a 95 % payment against the reserved "(Demo Corp)" tenant's oldest
// unpaid invoice, fires the auto-issuance engine, returns timings + toast copy.
export async function POST() {
  const [tenant] = await db.select().from(customers).where(like(customers.name, '%(Demo Corp)')).limit(1)
  if (!tenant) return NextResponse.json({ error: 'demo tenant not seeded' }, { status: 500 })

  const [invoice] = await db.select().from(invoices).where(and(
    eq(invoices.customerId, tenant.customerId), eq(invoices.status, 'PENDING')
  )).limit(1)
  if (!invoice) return NextResponse.json({ error: 'no open invoice on demo tenant' }, { status: 500 })

  const amount = (Number(invoice.amount) * 0.95).toFixed(2)
  const [payment] = await db.insert(incomingPayments).values({
    invoiceId: invoice.invoiceId, customerId: tenant.customerId,
    amount, paymentMethod: 'BANK_TRANSFER',
    referenceNumber: 'BPI-' + Date.now(),
    status: 'CONFIRMED', confirmedAt: new Date(),
  } as any).returning()

  const result = await tryAutoIssueForPayment(payment.paymentId)

  return NextResponse.json({
    timings: [
      { at: 500, toast: `Bank transfer received — ${tenant.name.replace(' (Demo Corp)','')} · ₱${Number(amount).toLocaleString()}` },
      { at: 1500, toast: `CWT gap detected: ₱${(Number(invoice.amount) * 0.05).toLocaleString()} @ 5.00% · ATC WC100` },
      { at: 2500, toast: `BIR 2307 rendered · ref ${(result as any).referenceNumber ?? '—'}` },
      { at: 3500, toast: `Invoice INV-${invoice.invoiceNumber} closed · tenant notified` },
    ],
    certificateId: (result as any).certificateId,
    invoiceId: invoice.invoiceId,
  })
}
```

- [ ] **Step 2: Add a reset endpoint**

Create `app/src/app/api/demo/reset-cwt-demo/route.ts`:

```ts
import { NextResponse } from 'next/server'
import { db } from '@/db'
import { customers, invoices, incomingPayments, cwtCertificates } from '@/db/schema'
import { and, eq, like } from 'drizzle-orm'

export async function POST() {
  const [tenant] = await db.select().from(customers).where(like(customers.name, '%(Demo Corp)')).limit(1)
  if (!tenant) return NextResponse.json({ ok: true })
  await db.delete(cwtCertificates).where(eq(cwtCertificates.customerId, tenant.customerId))
  await db.delete(incomingPayments).where(eq(incomingPayments.customerId, tenant.customerId))
  await db.update(invoices).set({ status: 'PENDING', balanceRemaining: invoices.amount as any })
    .where(eq(invoices.customerId, tenant.customerId))
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 3: Commit**

```bash
git add app/src/app/api/demo/
git commit -m "feat(cwt): demo simulate + reset endpoints for magic moment"
```

---

## Phase 5 — Intelligence layer

### Task 5.1: Gemini ATC classifier

**Files:** Create `app/src/lib/cwt/classifier.ts`, `app/src/app/api/cwt/classify-atc/route.ts`.

- [ ] **Step 1: Implement classifier**

Create `app/src/lib/cwt/classifier.ts`:

```ts
import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

const SYSTEM = `You are a PH BIR withholding-tax classifier. Given a contract description and tenant type, return the correct ATC code and rate per RR 11-2018 / RR 2-98 §2.57.2. Known codes: WC100 (5% rent on real property, private lessee), WC640 (5% govt lessee), WC158 (2% services), null (not subject).`

export interface AtcSuggestion { code: string | null; ratePct: number; confidence: number; reasoning: string }

export async function classifyAtc(input: { contractDescription: string; tenantBusinessType: string; taxClassification: string }): Promise<AtcSuggestion> {
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: SchemaType.OBJECT,
        properties: {
          code: { type: SchemaType.STRING, nullable: true },
          ratePct: { type: SchemaType.NUMBER },
          confidence: { type: SchemaType.NUMBER },
          reasoning: { type: SchemaType.STRING },
        }, required: ['ratePct', 'confidence', 'reasoning'],
      } as any,
    },
  })
  const res = await model.generateContent([{ text: SYSTEM }, { text: JSON.stringify(input) }])
  return JSON.parse(res.response.text())
}
```

- [ ] **Step 2: Expose via API**

Create `app/src/app/api/cwt/classify-atc/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { classifyAtc } from '@/lib/cwt/classifier'
import { withAuth } from '@/lib/auth-middleware'

export const POST = withAuth(async (req: NextRequest) => {
  const body = await req.json()
  const result = await classifyAtc(body)
  return NextResponse.json(result)
})
```

- [ ] **Step 3: Smoke-test**

```bash
curl -X POST http://localhost:3000/api/cwt/classify-atc \
  -H "Authorization: Bearer <FIREBASE_TOKEN>" -H "Content-Type: application/json" \
  -d '{"contractDescription":"Lease of retail space in Ayala Malls","tenantBusinessType":"Retail corporation","taxClassification":"PRIVATE"}'
```

Expected: returns `{"code":"WC100","ratePct":5,"confidence":0.9..,"reasoning":"..."}`.

- [ ] **Step 4: Commit**

```bash
git add app/src/lib/cwt/classifier.ts app/src/app/api/cwt/classify-atc/
git commit -m "feat(cwt): Gemini-backed ATC classifier"
```

### Task 5.2: Gemini Vision 2307 OCR ingestion

**Files:** Create `app/src/lib/cwt/ocr.ts`, `app/src/app/api/cwt/ingest-ocr/route.ts`.

- [ ] **Step 1: Extractor**

Create `app/src/lib/cwt/ocr.ts`:

```ts
import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

export interface OcrExtracted {
  payorTin: string | null
  payorName: string | null
  payeeTin: string | null
  payeeName: string | null
  atcCode: string | null
  grossAmount: number | null
  taxWithheldAmount: number | null
  periodStart: string | null  // YYYY-MM-DD
  periodEnd: string | null
  signedByName: string | null
  confidence: number
}

export async function extract2307(pdfBase64: string): Promise<OcrExtracted> {
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: SchemaType.OBJECT,
        properties: {
          payorTin: { type: SchemaType.STRING, nullable: true },
          payorName: { type: SchemaType.STRING, nullable: true },
          payeeTin: { type: SchemaType.STRING, nullable: true },
          payeeName: { type: SchemaType.STRING, nullable: true },
          atcCode: { type: SchemaType.STRING, nullable: true },
          grossAmount: { type: SchemaType.NUMBER, nullable: true },
          taxWithheldAmount: { type: SchemaType.NUMBER, nullable: true },
          periodStart: { type: SchemaType.STRING, nullable: true },
          periodEnd: { type: SchemaType.STRING, nullable: true },
          signedByName: { type: SchemaType.STRING, nullable: true },
          confidence: { type: SchemaType.NUMBER },
        }, required: ['confidence'],
      } as any,
    },
  })
  const res = await model.generateContent([
    { text: 'Extract every field of this BIR 2307 certificate. Return YYYY-MM-DD for dates.' },
    { inlineData: { mimeType: 'application/pdf', data: pdfBase64 } },
  ])
  return JSON.parse(res.response.text())
}
```

- [ ] **Step 2: Ingestion + matching endpoint**

Create `app/src/app/api/cwt/ingest-ocr/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { customers, invoices, incomingPayments, cwtCertificates, escalations } from '@/db/schema'
import { and, eq, between } from 'drizzle-orm'
import { extract2307 } from '@/lib/cwt/ocr'
import { withAuth } from '@/lib/auth-middleware'

export const POST = withAuth(async (req: NextRequest) => {
  const { pdfBase64 } = await req.json()
  const extracted = await extract2307(pdfBase64)
  if (!extracted.payorTin || !extracted.taxWithheldAmount) {
    return NextResponse.json({ matched: false, extracted, reason: 'missing required fields' })
  }

  const matches = await db.select().from(customers).where(eq(customers.tin, extracted.payorTin)).limit(1)
  const [tenant] = matches
  if (!tenant) return NextResponse.json({ matched: false, extracted, reason: 'no tenant with that TIN' })

  const candidateInvoices = await db.select().from(invoices).where(and(
    eq(invoices.customerId, tenant.customerId),
    between(invoices.billingPeriodEnd, extracted.periodStart ?? '1970-01-01', extracted.periodEnd ?? '2100-01-01'),
  )).limit(5)
  const unique = candidateInvoices.filter(inv =>
    Math.abs(Number(inv.amount) * 0.05 - (extracted.taxWithheldAmount ?? 0)) < 1
  )
  if (unique.length !== 1) {
    await db.insert(escalations).values({
      documentId: 0, customerId: tenant.customerId,
      escalationType: 'CWT_OCR_AMBIGUOUS',
      description: `OCR extracted ${JSON.stringify(extracted)} — ${unique.length} candidate invoices`,
      status: 'OPEN',
    } as any)
    return NextResponse.json({ matched: false, extracted, reason: 'ambiguous', candidates: unique.length })
  }

  const inv = unique[0]
  const [cert] = await db.insert(cwtCertificates).values({
    customerId: tenant.customerId, contractId: inv.contractId, invoiceId: inv.invoiceId,
    grossAmount: inv.amount, withheldAmount: String(extracted.taxWithheldAmount),
    ratePct: '5.00', atcCode: extracted.atcCode ?? 'WC100',
    periodStart: inv.billingPeriodStart, periodEnd: inv.billingPeriodEnd,
    referenceNumber: 'OCR' + Date.now().toString().slice(-12),
    pdfUrl: `data:application/pdf;base64,${pdfBase64}`,
    signatureApplied: true, status: 'ISSUED', source: 'OCR_INGESTED',
    signedByName: extracted.signedByName,
    issuedAt: new Date(),
  }).returning()

  return NextResponse.json({ matched: true, certificateId: cert.certificateId, extracted })
})
```

- [ ] **Step 3: Commit**

```bash
git add app/src/lib/cwt/ocr.ts app/src/app/api/cwt/ingest-ocr/
git commit -m "feat(cwt): Gemini Vision 2307 OCR + invoice matching"
```

---

## Phase 6 — AR pages + exports

### Task 6.1: AR CWT certificate queue

**Files:** Create `app/src/app/collections/cwt/page.tsx`, `app/src/app/collections/cwt/[id]/page.tsx`, `app/src/components/cwt/CertificateQueue.tsx`, `app/src/components/cwt/Bir2307Preview.tsx`.

- [ ] **Step 1: Queue page + component**

Create `app/src/app/collections/cwt/page.tsx`:

```tsx
import { db } from '@/db'
import { cwtCertificates, customers, invoices } from '@/db/schema'
import { desc, eq } from 'drizzle-orm'
import { CertificateQueue } from '@/components/cwt/CertificateQueue'

export default async function Page() {
  const rows = await db.select({
    c: cwtCertificates, cust: customers, inv: invoices,
  }).from(cwtCertificates)
    .leftJoin(customers, eq(customers.customerId, cwtCertificates.customerId))
    .leftJoin(invoices,  eq(invoices.invoiceId,   cwtCertificates.invoiceId))
    .orderBy(desc(cwtCertificates.issuedAt))
    .limit(100)

  return <CertificateQueue rows={rows.map(r => ({
    id: r.c.certificateId,
    referenceNumber: r.c.referenceNumber,
    tenantName: r.cust?.name ?? '', tenantTin: r.cust?.tin ?? '',
    invoiceNumber: r.inv?.invoiceNumber ?? '', atcCode: r.c.atcCode,
    withheldAmount: r.c.withheldAmount, issuedAt: r.c.issuedAt, status: r.c.status, source: r.c.source,
  }))} />
}
```

Create `app/src/components/cwt/CertificateQueue.tsx`:

```tsx
'use client'
import Link from 'next/link'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Row = {
  id: number; referenceNumber: string; tenantName: string; tenantTin: string;
  invoiceNumber: string; atcCode: string; withheldAmount: string;
  issuedAt: Date | null; status: string; source: string;
}

export function CertificateQueue({ rows }: { rows: Row[] }) {
  const [statusFilter, setStatus] = useState<'ALL' | 'ISSUED' | 'ESCALATED' | 'DRAFT'>('ALL')
  const filtered = statusFilter === 'ALL' ? rows : rows.filter(r => r.status === statusFilter)
  const total = filtered.reduce((s, r) => s + Number(r.withheldAmount), 0)
  const router = useRouter()

  return (
    <div className="p-8 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">BIR 2307 Certificates</h1>
        <div className="flex gap-2">
          {(['ALL','ISSUED','ESCALATED','DRAFT'] as const).map(s => (
            <button key={s} onClick={() => setStatus(s)}
              className={`px-3 py-1 rounded text-sm ${statusFilter===s ? 'bg-blue-600 text-white' : 'bg-slate-100'}`}>{s}</button>
          ))}
          <a href="/api/reports/qap" className="px-3 py-1 rounded bg-slate-900 text-white text-sm">Export QAP CSV</a>
        </div>
      </div>
      <div className="text-sm text-slate-500">{filtered.length} certificates · ₱{total.toLocaleString(undefined,{minimumFractionDigits:2})} withheld</div>
      <table className="w-full text-sm">
        <thead className="text-left text-slate-500 border-b">
          <tr><th className="py-2">Ref</th><th>Tenant</th><th>TIN</th><th>Invoice</th><th>ATC</th><th>Withheld</th><th>Issued</th><th>Status</th></tr>
        </thead>
        <tbody>
          {filtered.map(r => (
            <tr key={r.id} className="border-b hover:bg-slate-50 cursor-pointer" onClick={() => router.push(`/collections/cwt/${r.id}`)}>
              <td className="py-2 font-mono">{r.referenceNumber}</td>
              <td>{r.tenantName}</td><td>{r.tenantTin}</td>
              <td>{r.invoiceNumber}</td><td>{r.atcCode}</td>
              <td>₱{Number(r.withheldAmount).toLocaleString(undefined,{minimumFractionDigits:2})}</td>
              <td>{r.issuedAt?.toLocaleDateString?.() ?? ''}</td>
              <td><span className={`px-2 py-0.5 rounded text-xs ${r.status==='ISSUED'?'bg-green-100 text-green-700':r.status==='ESCALATED'?'bg-rose-100 text-rose-700':'bg-slate-100 text-slate-700'}`}>{r.status}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
```

- [ ] **Step 2: Detail page + PDF preview**

Create `app/src/app/collections/cwt/[id]/page.tsx`:

```tsx
import { db } from '@/db'
import { cwtCertificates } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { Bir2307Preview } from '@/components/cwt/Bir2307Preview'

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [c] = await db.select().from(cwtCertificates).where(eq(cwtCertificates.certificateId, Number(id)))
  if (!c) return <div className="p-8">Not found</div>
  return (
    <div className="p-8 space-y-4">
      <div>
        <div className="text-sm text-slate-500">Reference</div>
        <div className="text-2xl font-mono">{c.referenceNumber}</div>
      </div>
      <Bir2307Preview pdfDataUrl={c.pdfUrl ?? ''} />
    </div>
  )
}
```

Create `app/src/components/cwt/Bir2307Preview.tsx`:

```tsx
'use client'
export function Bir2307Preview({ pdfDataUrl }: { pdfDataUrl: string }) {
  if (!pdfDataUrl) return <div className="text-slate-500">(no PDF rendered yet)</div>
  return <iframe src={pdfDataUrl} className="w-full h-[900px] border rounded bg-white" />
}
```

- [ ] **Step 3: Manual verification**

Run the server, visit `/collections/cwt`, confirm the queue populates. Click a row and verify the 2307 PDF opens in the iframe.

- [ ] **Step 4: Commit**

```bash
git add app/src/app/collections/cwt/ app/src/components/cwt/CertificateQueue.tsx app/src/components/cwt/Bir2307Preview.tsx
git commit -m "feat(cwt): AR certificate queue + detail view"
```

### Task 6.2: QAP CSV export endpoint

**Files:** Create `app/src/app/api/reports/qap/route.ts`.

- [ ] **Step 1: Implement**

Create `app/src/app/api/reports/qap/route.ts`:

```ts
import { db } from '@/db'
import { cwtCertificates, customers } from '@/db/schema'
import { desc, eq, and, gte, lte } from 'drizzle-orm'
import { buildQapCsv } from '@/lib/cwt/qap'
import { NextRequest } from 'next/server'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const periodStart = searchParams.get('from') ?? new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)
  const periodEnd = searchParams.get('to') ?? new Date().toISOString().slice(0, 10)

  const rows = await db.select({
    atcCode: cwtCertificates.atcCode,
    payorTin: customers.tin,
    payorBranchCode: customers.branchCode,
    payorName: customers.name,
    grossAmount: cwtCertificates.grossAmount,
    withheldAmount: cwtCertificates.withheldAmount,
    periodEnd: cwtCertificates.periodEnd,
    referenceNumber: cwtCertificates.referenceNumber,
  }).from(cwtCertificates).leftJoin(customers, eq(customers.customerId, cwtCertificates.customerId))
    .where(and(
      eq(cwtCertificates.status, 'ISSUED'),
      gte(cwtCertificates.periodEnd, periodStart),
      lte(cwtCertificates.periodEnd, periodEnd),
    )).orderBy(desc(cwtCertificates.periodEnd))

  const csv = buildQapCsv(rows as any)
  return new Response(csv, { headers: {
    'Content-Type': 'text/csv',
    'Content-Disposition': `attachment; filename="QAP-${periodStart}-${periodEnd}.csv"`,
  } })
}
```

- [ ] **Step 2: Smoke test**

```bash
curl -s http://localhost:3000/api/reports/qap | head -10
```

Expected: CSV header + rows + totals.

- [ ] **Step 3: Commit**

```bash
git add app/src/app/api/reports/qap
git commit -m "feat(cwt): QAP CSV export endpoint"
```

### Task 6.3: Receivable page — CWT badge + linked cert

**Files:** Modify `app/src/app/receivable/[id]/page.tsx`.

- [ ] **Step 1: Read the current page**

Open `app/src/app/receivable/[id]/page.tsx` in full. Identify the section rendering invoice details.

- [ ] **Step 2: Fetch linked certificate and render badge**

Near the top of the server component, add:

```ts
import { cwtCertificates } from '@/db/schema'
const [cert] = await db.select().from(cwtCertificates)
  .where(eq(cwtCertificates.invoiceId, invoice.invoiceId)).limit(1)
```

In the status section, add a badge when `cert` exists:

```tsx
{cert && (
  <a href={`/collections/cwt/${cert.certificateId}`}
    className="inline-flex items-center gap-2 px-3 py-1 rounded bg-blue-50 text-blue-700 text-sm">
    <span>BIR 2307 · {cert.referenceNumber}</span>
    <span className="text-blue-500">→</span>
  </a>
)}
```

- [ ] **Step 3: Verify**

Visit `/receivable/[id]` for an invoice with a seeded certificate; confirm the badge appears and clicks through to the detail view.

- [ ] **Step 4: Commit**

```bash
git add app/src/app/receivable/\[id\]/page.tsx
git commit -m "feat(cwt): link BIR 2307 badge from invoice detail"
```

---

## Phase 7 — Emulator magic moment

### Task 7.1: Emulator panel button

**Files:** Modify `app/src/store/` (existing `emulator` slice), `app/src/components/emulator/*`.

- [ ] **Step 1: Read the existing emulator slice and panel**

Open `app/src/store/emulatorSlice.ts` (or equivalent) and the main emulator panel component. Identify the action/button pattern used for existing emulator controls.

- [ ] **Step 2: Add the simulate action**

In the emulator slice, add:

```ts
toasts: [] as { id: number; text: string; appearAt: number }[],
// reducers:
pushToasts(state, action: PayloadAction<{ toasts: { text: string; appearAt: number }[] }>) {
  let id = Date.now()
  for (const t of action.payload.toasts) state.toasts.push({ id: id++, ...t })
},
clearToasts(state) { state.toasts = [] },
```

- [ ] **Step 3: Wire the button**

In the panel component:

```tsx
const simulate = async () => {
  dispatch(clearToasts())
  const res = await fetch('/api/demo/simulate-cwt-payment', { method: 'POST' })
  const data = await res.json()
  dispatch(pushToasts({ toasts: data.timings.map((t: any) => ({ text: t.toast, appearAt: Date.now() + t.at })) }))
}
const reset = () => fetch('/api/demo/reset-cwt-demo', { method: 'POST' })
```

Render:

```tsx
<div className="border-t pt-3 mt-3 space-y-2">
  <div className="text-xs uppercase text-slate-400">CWT demo</div>
  <button onClick={simulate} className="btn w-full">Simulate: corporate rent payment (net of CWT)</button>
  <button onClick={reset} className="btn-muted w-full text-sm">Reset demo tenant</button>
</div>
```

- [ ] **Step 4: Toast renderer**

Add a `<EmulatorToasts />` component listening to the store and rendering toasts when `Date.now() >= appearAt`. Use `setTimeout` to schedule reveal of each toast and a 10 s auto-dismiss. Mount it in `app/src/app/layout.tsx` so toasts show across every page.

- [ ] **Step 5: Manual run-through**

Open `/collections/cwt` in two tabs (one has the emulator open, the other is the dashboard). Click the simulate button and verify all four toasts appear at roughly the expected timings, the row animates into the queue, the PDF renders when clicked, and reset restores the tenant.

- [ ] **Step 6: Commit**

```bash
git add app/src/store/ app/src/components/emulator/ app/src/app/layout.tsx
git commit -m "feat(emulator): CWT magic-moment simulate + toast flow"
```

### Task 7.2: Mock tenant inbox preview

**Files:** Create `app/src/components/cwt/TenantInboxPreview.tsx`, wire into certificate detail page.

- [ ] **Step 1: Build the component**

Create `app/src/components/cwt/TenantInboxPreview.tsx`:

```tsx
'use client'
import { useState } from 'react'
export function TenantInboxPreview({ tenantEmail, referenceNumber, pdfDataUrl }: { tenantEmail: string; referenceNumber: string; pdfDataUrl: string }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button onClick={() => setOpen(true)} className="text-sm text-blue-600 hover:underline">Tenant inbox preview →</button>
      {open && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-6 z-50" onClick={() => setOpen(false)}>
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full p-6 space-y-3" onClick={e => e.stopPropagation()}>
            <div className="text-xs text-slate-400">Gmail — Inbox</div>
            <div className="flex items-center justify-between border-b pb-2">
              <div>
                <div className="font-medium">BIR 2307 — ref {referenceNumber}</div>
                <div className="text-xs text-slate-500">noreply@ayalaland.com.ph → {tenantEmail}</div>
              </div>
              <div className="text-xs text-slate-400">just now</div>
            </div>
            <div className="text-sm">Your BIR Form 2307 for the recent lease payment has been generated on your behalf under the authorization you granted at enrollment. A signed copy is attached for your records.</div>
            <div className="flex items-center gap-2 border rounded p-2 text-sm">📎 BIR-2307-{referenceNumber}.pdf</div>
          </div>
        </div>
      )}
    </>
  )
}
```

- [ ] **Step 2: Mount on the detail page**

Modify `app/src/app/collections/cwt/[id]/page.tsx` to include `<TenantInboxPreview ...>` next to the reference number.

- [ ] **Step 3: Commit**

```bash
git add app/src/components/cwt/TenantInboxPreview.tsx app/src/app/collections/cwt/\[id\]/page.tsx
git commit -m "feat(cwt): mock tenant inbox preview modal"
```

---

## Phase 8 — Screenshot pipeline

### Task 8.1: Playwright capture script

**Files:** Create `app/scripts/capture-screenshots.ts`.

- [ ] **Step 1: Script**

Create `app/scripts/capture-screenshots.ts`:

```ts
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import { writeFile, mkdir } from 'node:fs/promises'
import path from 'node:path'
import { setTimeout as sleep } from 'node:timers/promises'

const OUT = path.resolve(__dirname, '../../decks-tmp-screenshots')
const DEV_URL = 'http://localhost:3000'

async function waitForServer(url: string, timeoutMs = 60000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try { const r = await fetch(url); if (r.ok) return } catch {}
    await sleep(500)
  }
  throw new Error('dev server never came up')
}

async function main() {
  await mkdir(OUT, { recursive: true })
  const dev = spawn('npm', ['run', 'dev'], { cwd: path.resolve(__dirname, '..'), stdio: 'inherit' })
  try {
    await waitForServer(DEV_URL)
    await fetch(`${DEV_URL}/api/seed`, { method: 'POST' })
    await fetch(`${DEV_URL}/api/demo/reset-cwt-demo`, { method: 'POST' })

    const browser = await chromium.launch()
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })

    await page.goto(`${DEV_URL}/pay/enroll?customerId=10&token=demo`)
    await page.waitForLoadState('networkidle')
    await page.screenshot({ path: path.join(OUT, 'enrollment.png'), fullPage: false })

    await page.goto(`${DEV_URL}/collections/cwt`)
    await page.waitForLoadState('networkidle')
    await page.screenshot({ path: path.join(OUT, 'magic-before.png') })
    await page.screenshot({ path: path.join(OUT, 'ar-queue.png') })

    // Fire the demo simulate and capture the resulting 2307 PDF preview
    const sim = await (await fetch(`${DEV_URL}/api/demo/simulate-cwt-payment`, { method: 'POST' })).json()
    await page.goto(`${DEV_URL}/collections/cwt/${sim.certificateId}`)
    await page.waitForLoadState('networkidle')
    await page.screenshot({ path: path.join(OUT, 'magic-pdf.png') })

    await page.goto(`${DEV_URL}/receivable/${sim.invoiceId}`)
    await page.waitForLoadState('networkidle')
    await page.screenshot({ path: path.join(OUT, 'magic-after.png') })

    await page.goto(`${DEV_URL}/collections/escalations`)
    await page.waitForLoadState('networkidle')
    await page.screenshot({ path: path.join(OUT, 'escalation.png') })

    await browser.close()
    console.log('captured 6 screenshots to', OUT)
  } finally {
    dev.kill()
  }
}
main().catch(e => { console.error(e); process.exit(1) })
```

- [ ] **Step 2: Run**

```bash
cd ~/projects/mpe-collections-demo/app && npm run screenshot
```

Expected: `decks-tmp-screenshots/*.png` directory with 6 files.

- [ ] **Step 3: Commit**

```bash
git add app/scripts/capture-screenshots.ts
git commit -m "feat(cwt): Playwright screenshot capture for deck"
```

---

## Phase 9 — Searce-branded deck

### Task 9.1: Deck folder setup

**Files:** Create `~/projects/searce/ayalaland/decks/` with logos + build script.

- [ ] **Step 1: Create folder + copy logos**

```bash
mkdir -p ~/projects/searce/ayalaland/decks
cp ~/projects/searce/indosat/docs/saos/searce-logo.svg ~/projects/searce/ayalaland/decks/
cp ~/projects/searce/indosat/docs/saos/searce-logo-white.svg ~/projects/searce/ayalaland/decks/
```

- [ ] **Step 2: Install Python deps for the build script**

```bash
cd ~/projects/searce/ayalaland/decks
python3 -m venv .venv
.venv/bin/pip install python-pptx pillow cairosvg
```

- [ ] **Step 3: Commit**

```bash
git add -A  # or specific files depending on repo containment
git commit -m "chore: scaffold Ayala Land deck folder with Searce logos"
```

### Task 9.2: Build-deck script

**Files:** Create `~/projects/searce/ayalaland/decks/build-deck.py`.

- [ ] **Step 1: Write the script**

Create `~/projects/searce/ayalaland/decks/build-deck.py`:

```python
"""Build the Ayala Land CWT Phase-2 proposal deck.

Usage:
    python build-deck.py

This imports screenshots from ../../mpe-collections-demo/decks-tmp-screenshots,
copies them into ./screenshots, and emits
2026-04-21-cwt-automation-phase2.pptx in this folder.
"""
from pathlib import Path
from shutil import copy2
import cairosvg
from pptx import Presentation
from pptx.util import Inches, Pt, Emu
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_SHAPE
from pptx.enum.text import PP_ALIGN

HERE      = Path(__file__).resolve().parent
DEMO_SHOTS= HERE.parent.parent.parent / 'mpe-collections-demo' / 'decks-tmp-screenshots'
SHOTS_OUT = HERE / 'screenshots'
SHOTS_OUT.mkdir(exist_ok=True)

# Mirror the Searce theme from indosat/presentation-remotion/src/theme.ts
NAVY   = RGBColor(0x00, 0x16, 0x30)
DARK   = RGBColor(0x0C, 0x26, 0x56)
BLUE   = RGBColor(0x00, 0x45, 0x96)
ACCENT = RGBColor(0x00, 0x64, 0xFF)
LIGHT  = RGBColor(0xE5, 0xEE, 0xFC)
GRAY50 = RGBColor(0xF9, 0xFA, 0xFB)
GRAY500= RGBColor(0x6B, 0x72, 0x80)
GRAY600= RGBColor(0x4B, 0x55, 0x63)
WHITE  = RGBColor(0xFF, 0xFF, 0xFF)
AMBER  = RGBColor(0xF5, 0x9E, 0x0B)
GREEN  = RGBColor(0x10, 0xB9, 0x81)
ROSE   = RGBColor(0xF4, 0x3F, 0x5E)

SLIDE_W, SLIDE_H = Inches(13.333), Inches(7.5)   # 16:9

def svg_to_png(svg_path: Path, out_path: Path, width_px=240):
    cairosvg.svg2png(url=str(svg_path), write_to=str(out_path), output_width=width_px)

def copy_shots():
    for f in DEMO_SHOTS.glob('*.png'):
        copy2(f, SHOTS_OUT / f.name)

def set_bg(slide, color: RGBColor):
    bg = slide.background.fill
    bg.solid()
    bg.fore_color.rgb = color

def add_top_bar(slide, logo_path: Path, section_label: str):
    # white bar + Searce logo + breadcrumb text + section pill
    bar = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, 0, 0, SLIDE_W, Inches(0.7))
    bar.fill.solid(); bar.fill.fore_color.rgb = WHITE
    bar.line.fill.background()
    slide.shapes.add_picture(str(logo_path), Inches(0.4), Inches(0.22), height=Inches(0.26))

    crumb = slide.shapes.add_textbox(Inches(1.7), Inches(0.22), Inches(6), Inches(0.3))
    tf = crumb.text_frame; tf.text = 'Ayala Land · Collections Phase 2'
    tf.paragraphs[0].font.size = Pt(11); tf.paragraphs[0].font.color.rgb = GRAY500
    tf.paragraphs[0].font.name = 'Manrope'

    if section_label:
        pill = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(10.8), Inches(0.2), Inches(2.2), Inches(0.3))
        pill.fill.solid(); pill.fill.fore_color.rgb = LIGHT
        pill.line.color.rgb = ACCENT
        pill.adjustments[0] = 1.0
        tf = pill.text_frame; tf.text = section_label.upper()
        tf.paragraphs[0].alignment = PP_ALIGN.CENTER
        tf.paragraphs[0].font.bold = True; tf.paragraphs[0].font.size = Pt(9)
        tf.paragraphs[0].font.color.rgb = ACCENT

    # accent stripe
    stripe = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, 0, Inches(0.7), SLIDE_W, Emu(38100))
    stripe.fill.gradient()  # falls through to solid if gradient unsupported — fine
    stripe.fill.solid(); stripe.fill.fore_color.rgb = ACCENT
    stripe.line.fill.background()

def add_bottom_bar(slide, page_num: int):
    text = slide.shapes.add_textbox(Inches(0.4), Inches(7.1), Inches(9), Inches(0.3))
    tf = text.text_frame; tf.text = 'Searce · Proposal · April 2026'
    tf.paragraphs[0].font.size = Pt(10); tf.paragraphs[0].font.color.rgb = GRAY500
    tf.paragraphs[0].font.name = 'Manrope'
    num = slide.shapes.add_textbox(Inches(12.5), Inches(7.1), Inches(0.6), Inches(0.3))
    tf = num.text_frame; tf.text = str(page_num)
    tf.paragraphs[0].alignment = PP_ALIGN.RIGHT
    tf.paragraphs[0].font.size = Pt(10); tf.paragraphs[0].font.color.rgb = GRAY500

def add_content(slide, section, title, body, visual_fn=None, page_num=1):
    set_bg(slide, GRAY50)
    add_top_bar(slide, HERE / 'searce-logo.svg.png', section)
    add_bottom_bar(slide, page_num)

    title_box = slide.shapes.add_textbox(Inches(0.7), Inches(1.0), Inches(9.5), Inches(1.0))
    tf = title_box.text_frame; tf.word_wrap = True
    p = tf.paragraphs[0]; p.text = title
    p.font.size = Pt(36); p.font.bold = True; p.font.color.rgb = NAVY
    p.font.name = 'Manrope'

    body_box = slide.shapes.add_textbox(Inches(0.7), Inches(2.1), Inches(6.0), Inches(4.0))
    tf = body_box.text_frame; tf.word_wrap = True
    p = tf.paragraphs[0]; p.text = body
    p.font.size = Pt(14); p.font.color.rgb = GRAY600
    p.font.name = 'Manrope'

    if visual_fn: visual_fn(slide)

def add_title_slide(prs):
    s = prs.slides.add_slide(prs.slide_layouts[6])
    set_bg(s, NAVY)
    # Searce logo white
    s.shapes.add_picture(str(HERE / 'searce-logo-white.svg.png'), Inches(0.7), Inches(0.6), height=Inches(0.35))
    t = s.shapes.add_textbox(Inches(0.7), Inches(2.8), Inches(11), Inches(2.5))
    tf = t.text_frame; tf.word_wrap = True
    p = tf.paragraphs[0]; p.text = 'Automated BIR 2307\nIssuance'
    p.font.size = Pt(60); p.font.bold = True; p.font.color.rgb = WHITE; p.font.name = 'Manrope'

    sub = s.shapes.add_textbox(Inches(0.7), Inches(5.2), Inches(11), Inches(0.6))
    tf = sub.text_frame
    p = tf.paragraphs[0]; p.text = 'Ayala Land Collections · Phase 2 · April 2026'
    p.font.size = Pt(18); p.font.color.rgb = LIGHT; p.font.name = 'Manrope'

def add_pain_slide(prs):
    s = prs.slides.add_slide(prs.slide_layouts[6])
    add_content(s, 'Pain', 'Every peso you collect from a corporate tenant is already 5% short.',
        'Corporate lessees are statutory withholding agents on rent. They pay net of 5%. The BIR 2307 that '
        'makes the short-payment creditable arrives weeks later — or never. Until it arrives the invoice '
        'cannot close and the BIR credit cannot be claimed.', page_num=2)

def add_cost_slide(prs):
    s = prs.slides.add_slide(prs.slide_layouts[6])
    set_bg(s, GRAY50)
    add_top_bar(s, HERE / 'searce-logo.svg.png', 'Cost')
    add_bottom_bar(s, 3)
    title = s.shapes.add_textbox(Inches(0.7), Inches(1.0), Inches(12), Inches(1.0))
    tf = title.text_frame; p = tf.paragraphs[0]; p.text = 'The unreconciled AR that 2307s create.'
    p.font.size = Pt(36); p.font.bold = True; p.font.color.rgb = NAVY; p.font.name = 'Manrope'

    # 2x2 stat grid
    stats = [
        ('~42%', 'of B2B invoices are short-paid by CWT'),
        ('₱12.4M', 'stuck in paid-but-not-closed invoices'),
        ('47 days', 'avg aging waiting for the matching 2307'),
        ('₱2.1M', 'annual BIR credit at risk if late at year-end'),
    ]
    for i, (big, small) in enumerate(stats):
        row, col = i // 2, i % 2
        x, y = Inches(0.7 + col * 6.0), Inches(2.3 + row * 2.3)
        card = s.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, x, y, Inches(5.5), Inches(2.0))
        card.fill.solid(); card.fill.fore_color.rgb = WHITE
        card.line.color.rgb = LIGHT
        card.adjustments[0] = 0.04
        tb = s.shapes.add_textbox(x, y + Inches(0.3), Inches(5.5), Inches(0.9))
        tf = tb.text_frame; tf.paragraphs[0].text = big
        tf.paragraphs[0].font.size = Pt(40); tf.paragraphs[0].font.bold = True
        tf.paragraphs[0].font.color.rgb = ACCENT; tf.paragraphs[0].font.name = 'Manrope'
        tb = s.shapes.add_textbox(x, y + Inches(1.2), Inches(5.5), Inches(0.8))
        tf = tb.text_frame; tf.paragraphs[0].text = small
        tf.paragraphs[0].font.size = Pt(13); tf.paragraphs[0].font.color.rgb = GRAY600
        tf.paragraphs[0].font.name = 'Manrope'; tf.word_wrap = True

def add_solution_slide(prs):
    s = prs.slides.add_slide(prs.slide_layouts[6])
    add_content(s, 'Solution', 'Stop waiting. Issue the 2307 yourself.',
        'One-time tenant enrollment grants Ayala Land’s portal durable authorization to generate, '
        'electronically sign, and deliver BIR 2307 on the tenant’s behalf. Every rent payment — bank, '
        'check, Stripe, QR — triggers automatic issuance. The invoice closes the day cash lands. '
        'Legal basis: RA 8792 and RR 16-2021.', page_num=4)

def add_precedent_slide(prs):
    s = prs.slides.add_slide(prs.slide_layouts[6])
    set_bg(s, GRAY50)
    add_top_bar(s, HERE / 'searce-logo.svg.png', 'Precedent')
    add_bottom_bar(s, 5)
    t = s.shapes.add_textbox(Inches(0.7), Inches(1.0), Inches(12), Inches(1.0))
    tf = t.text_frame; p = tf.paragraphs[0]
    p.text = 'Globe already does this. Here’s what’s different for Ayala.'
    p.font.size = Pt(32); p.font.bold = True; p.font.color.rgb = NAVY; p.font.name = 'Manrope'

    rows = [
        ('Industry',                     'Telco billing',              'Real-estate leasing'),
        ('Withholding rate',             '2% on services',             '5% on rent (ATC WC100)'),
        ('Payment rail',                 'In-portal only',             'Any rail — bank, check, Stripe, QR'),
        ('Transaction source',           'MyBSS → ADH → portal',       'Invoice from Collections demo'),
        ('Tenant action per 2307',       'Preparer + Approver click',  'One-time enrollment; zero per-payment'),
        ('2307 signing',                 'Stored signature (first)',   'Stored signature at enrollment'),
        ('Reconciliation',               'Portal posts to MyBSS',      'Auto-close invoice on gap match'),
        ('Non-enrolled tenants',         '—',                          'Gemini OCR + invoice match'),
    ]
    y0 = 2.2
    s.shapes.add_textbox(Inches(3.6), Inches(y0-0.5), Inches(4), Inches(0.3)).text_frame.text = 'Globe eCWT'
    s.shapes.add_textbox(Inches(8.6), Inches(y0-0.5), Inches(4), Inches(0.3)).text_frame.text = 'Ayala Phase 2'
    for idx, (cat, globe, ayala) in enumerate(rows):
        y = Inches(y0 + idx * 0.45)
        s.shapes.add_textbox(Inches(0.7), y, Inches(2.8), Inches(0.4)).text_frame.text = cat
        s.shapes.add_textbox(Inches(3.6), y, Inches(4.8), Inches(0.4)).text_frame.text = globe
        ay = s.shapes.add_textbox(Inches(8.6), y, Inches(4.3), Inches(0.4))
        tf = ay.text_frame; tf.paragraphs[0].text = ayala
        if idx in (2, 4, 6, 7):  # rows that "go beyond Globe"
            tf.paragraphs[0].font.bold = True; tf.paragraphs[0].font.color.rgb = ACCENT

def add_enrollment_slide(prs):
    s = prs.slides.add_slide(prs.slide_layouts[6])
    add_content(s, 'Demo', 'Tenant enrolls once.',
        'Company info · TIN proof · authorized signatory · stored signature · durable authorization consent. '
        'Mirrors the familiar Globe eCWT sign-up. Tenants do this once. Everything downstream is automatic.',
        visual_fn=lambda s: s.shapes.add_picture(str(SHOTS_OUT / 'enrollment.png'), Inches(7.0), Inches(1.8), width=Inches(5.8)),
        page_num=6)

def add_magic_slide(prs):
    s = prs.slides.add_slide(prs.slide_layouts[6])
    set_bg(s, GRAY50)
    add_top_bar(s, HERE / 'searce-logo.svg.png', 'Demo')
    add_bottom_bar(s, 7)
    t = s.shapes.add_textbox(Inches(0.7), Inches(1.0), Inches(12), Inches(1.0))
    tf = t.text_frame; p = tf.paragraphs[0]
    p.text = 'The magic moment.'
    p.font.size = Pt(36); p.font.bold = True; p.font.color.rgb = NAVY; p.font.name = 'Manrope'

    cap = s.shapes.add_textbox(Inches(0.7), Inches(1.8), Inches(12), Inches(0.7))
    tf = cap.text_frame; tf.paragraphs[0].text = 'Payment arrives ₱5K short → BIR 2307 auto-rendered, signed, invoice closed. Zero AR clicks.'
    tf.paragraphs[0].font.size = Pt(14); tf.paragraphs[0].font.color.rgb = GRAY600

    for i, name in enumerate(['magic-before.png', 'magic-pdf.png', 'magic-after.png']):
        s.shapes.add_picture(str(SHOTS_OUT / name), Inches(0.7 + i * 4.2), Inches(3.0), width=Inches(4.0))

def add_intelligence_slide(prs):
    s = prs.slides.add_slide(prs.slide_layouts[6])
    add_content(s, 'Intelligence', 'The AI that handles the messy edges.',
        '· Gemini classifies ATC codes on ambiguous contracts\n'
        '· Gemini Vision OCRs emailed 2307s from non-enrolled tenants and matches to invoices\n'
        '· Anomaly queue for gaps that don’t match declared rates — one-click AR resolution',
        visual_fn=lambda s: s.shapes.add_picture(str(SHOTS_OUT / 'escalation.png'), Inches(7.0), Inches(2.3), width=Inches(5.8)),
        page_num=8)

def add_outcome_slide(prs):
    s = prs.slides.add_slide(prs.slide_layouts[6])
    set_bg(s, GRAY50)
    add_top_bar(s, HERE / 'searce-logo.svg.png', 'Outcome')
    add_bottom_bar(s, 9)
    t = s.shapes.add_textbox(Inches(0.7), Inches(1.0), Inches(12), Inches(1.0))
    tf = t.text_frame; tf.paragraphs[0].text = 'What your AR team gets.'
    tf.paragraphs[0].font.size = Pt(36); tf.paragraphs[0].font.bold = True
    tf.paragraphs[0].font.color.rgb = NAVY; tf.paragraphs[0].font.name = 'Manrope'

    cards = [
        'Near-zero DSO on CWT-bearing invoices',
        'Monthly QAP/alphalist CSV ready to upload',
        'Audit-ready 2307 archive per tenant TIN',
        'Tenant self-service inbox — no more chasing',
    ]
    for i, text in enumerate(cards):
        row, col = i // 2, i % 2
        x, y = Inches(0.7 + col * 6.0), Inches(2.1 + row * 1.9)
        card = s.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, x, y, Inches(5.5), Inches(1.6))
        card.fill.solid(); card.fill.fore_color.rgb = WHITE
        card.line.color.rgb = ACCENT
        card.adjustments[0] = 0.06
        tb = s.shapes.add_textbox(x + Inches(0.3), y + Inches(0.4), Inches(5.0), Inches(1.0))
        tf = tb.text_frame; tf.word_wrap = True
        p = tf.paragraphs[0]; p.text = text
        p.font.size = Pt(15); p.font.bold = True; p.font.color.rgb = NAVY; p.font.name = 'Manrope'

def add_ask_slide(prs):
    s = prs.slides.add_slide(prs.slide_layouts[6])
    add_content(s, 'Ask', 'Add the Withholding Tax module to the Collections engagement.',
        'Phase-2 scope, building on the platform your team already uses. Re-uses existing schema, documents '
        'pipeline, and Gemini stack. Three deliverables:\n'
        '  · Tenant enrollment portal\n  · Auto-issuance engine\n  · AR QAP export\n\n'
        'Next step: SOW amendment.',
        page_num=10)

def main():
    copy_shots()
    svg_to_png(HERE / 'searce-logo.svg',       HERE / 'searce-logo.svg.png',       480)
    svg_to_png(HERE / 'searce-logo-white.svg', HERE / 'searce-logo-white.svg.png', 480)

    prs = Presentation()
    prs.slide_width, prs.slide_height = SLIDE_W, SLIDE_H

    add_title_slide(prs)
    add_pain_slide(prs)
    add_cost_slide(prs)
    add_solution_slide(prs)
    add_precedent_slide(prs)
    add_enrollment_slide(prs)
    add_magic_slide(prs)
    add_intelligence_slide(prs)
    add_outcome_slide(prs)
    add_ask_slide(prs)

    out = HERE / '2026-04-21-cwt-automation-phase2.pptx'
    prs.save(out)
    print(f'wrote {out}')

if __name__ == '__main__':
    main()
```

- [ ] **Step 2: Run it**

```bash
cd ~/projects/searce/ayalaland/decks && .venv/bin/python build-deck.py
```

Expected: `wrote .../2026-04-21-cwt-automation-phase2.pptx`.

- [ ] **Step 3: Open and eyeball**

Open the pptx in PowerPoint / Keynote / LibreOffice. Verify:
- Title slide full-bleed navy, logo top, big title, "Ayala Land Collections · Phase 2 · April 2026" subtitle.
- Every content slide has Searce logo + breadcrumb + pill on top, page number + footer on bottom.
- Slide 5 comparison table has four rows highlighted in accent blue.
- Slides 6, 7, 8, 9 embed the captured screenshots.

- [ ] **Step 4: Commit**

```bash
cd ~/projects/searce/ayalaland/decks
git init  # if the ayalaland folder isn't tracked yet — confirm first
git add build-deck.py searce-logo.svg searce-logo-white.svg .gitignore
git commit -m "feat: Ayala Land CWT Phase-2 proposal deck build script"
```

### Task 9.3: Add speaker notes

**Files:** Modify `build-deck.py`.

- [ ] **Step 1: After each `prs.slides.add_slide(...)`, populate notes**

For each slide-creator function, at the end add:

```python
notes = s.notes_slide.notes_text_frame
notes.text = """<one paragraph of speaker notes for this slide>"""
```

Write one crisp paragraph per slide — e.g. for the magic-moment slide:

> "This is the slide you linger on. The screenshot filmstrip mirrors the live emulator behaviour — bank payment arrives, gap detected, 2307 rendered, invoice closed. If you have a live connection, fire the emulator simulate button during this beat for live theatre; the static version works standalone too. Key message: zero AR clicks from detection to closure."

Write notes for all 10 slides in the same voice — directive, terse, presenter-facing.

- [ ] **Step 2: Re-run the build**

```bash
.venv/bin/python build-deck.py
```

- [ ] **Step 3: Commit**

```bash
git add build-deck.py
git commit -m "docs: speaker notes for every deck slide"
```

---

## Phase 10 — End-to-end verification

### Task 10.1: Full pipeline dry run

- [ ] **Step 1: Fresh checkout, clean slate**

```bash
cd ~/projects/mpe-collections-demo
git status  # should be clean
cd app && npm install
```

- [ ] **Step 2: Push schema (if running against a new DB)**

Re-execute Task 1.1 proxy pushes against whatever Supabase DB this environment is pointed at.

- [ ] **Step 3: Seed**

```bash
npm run dev &
sleep 5
curl -X POST http://localhost:3000/api/seed
```

Verify console output: enrollment count + historical cert count.

- [ ] **Step 4: Happy-path live test**

Open `http://localhost:3000/collections/cwt`, confirm populated queue. Open the emulator, click "Simulate: corporate rent payment", watch the 4-toast theatre, verify a new ISSUED row appears, click through to the 2307 PDF preview, click the tenant inbox preview, verify it opens.

- [ ] **Step 5: Anomaly test**

Open `/collections/escalations`, verify the seeded `CWT_GAP_MISMATCH` escalation is listed.

- [ ] **Step 6: OCR test**

Upload a sample 2307 PDF to `/api/cwt/ingest-ocr` via curl; confirm either `matched: true` + certificate row, or `matched: false, reason: ambiguous` + escalation.

- [ ] **Step 7: QAP test**

```bash
curl -s 'http://localhost:3000/api/reports/qap?from=2026-01-01&to=2026-04-30' | head
```

Verify CSV headers + data rows + totals row.

- [ ] **Step 8: Screenshot + deck**

```bash
cd app && npm run screenshot
cd ~/projects/searce/ayalaland/decks && .venv/bin/python build-deck.py
```

Open `2026-04-21-cwt-automation-phase2.pptx`. Check every slide looks right; speaker notes populate in the notes pane.

- [ ] **Step 9: Commit final housekeeping (if any)**

Any last tweaks discovered during the dry run — commit with clear messages.

### Task 10.2: Write a short DEMO-SCRIPT note

**Files:** Modify `app/docs/DEMO-SCRIPT.md` (already exists).

- [ ] **Step 1: Append a CWT section**

Add a section to the existing `DEMO-SCRIPT.md`:

```markdown
## CWT auto-issuance (Phase 2 pitch)

Before the meeting:
1. Run `curl -X POST $BASE_URL/api/seed` against the demo DB
2. Run `curl -X POST $BASE_URL/api/demo/reset-cwt-demo`
3. Open `/collections/cwt` in the browser (populated queue)
4. Open the emulator panel, keep the "Simulate corporate rent payment" button visible

During the meeting, after slide 7 lands:
1. Click the simulate button
2. Narrate the toasts as they appear (bank → gap → 2307 rendered → invoice closed)
3. Click the new row in the queue to open the PDF preview
4. Click "Tenant inbox preview" to show the email was delivered

If something fails: slide 7 has static screenshots of the exact flow, and the deck stands alone.
```

- [ ] **Step 2: Commit**

```bash
git add app/docs/DEMO-SCRIPT.md
git commit -m "docs: CWT pitch demo script"
```

---

## Self-review notes

- **Spec coverage check:** Every spec section has at least one task. Enrollment UI + API → Task 3.*; auto-issuance → Task 4.1; OCR → Task 5.2; ATC classifier → Task 5.1; escalations → rolled into 4.1 and 5.2 via `escalations_col`; QAP export → Task 6.2; seeded corporate tenants → Task 2.2; signatures → Task 2.1; PDF rendering → Task 1.5–1.6; magic moment → Task 7.1; screenshot capture → Task 8.1; deck → Task 9.1–9.3; verification → Task 10.*.
- **Type consistency:** `classifyPaymentGap` returns `CWT_MATCH | CWT_MISMATCH | FULL | PARTIAL | NONE`; all downstream branches in Task 4.1 explicitly handle `CWT_MATCH` and `CWT_MISMATCH` and skip the rest. `AtcMatch` shape (`{code, ratePct}`) matches `classifyAtc` return except `classifyAtc` adds `confidence` and `reasoning` — documented.
- **Pending at build time:** the field IDs in `pdf-field-map.ts` are placeholders — Task 1.6 step 1 explicitly calls out that an engineer must align them to the real AcroForm field IDs produced by Task 1.5, and gives the verification procedure (Task 1.6 step 3).
- **BIR template availability:** Task 0.2 has a fallback ("if the URL has moved, navigate manually") so the plan doesn't stall on a dead link.
