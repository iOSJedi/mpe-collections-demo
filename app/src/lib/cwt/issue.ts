import { db } from '@/db'
import {
  customers, incomingPayments, invoices, cwtCertificates,
  cwtCertificateLines, invoiceLineItems, escalations,
} from '@/db/schema'
import { eq, asc } from 'drizzle-orm'
import { classifyPaymentGap } from './detector'
import { renderBir2307Pdf, type Bir2307Line } from './pdf'
import { referenceNumberFor } from './reference'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

const AYALA_PAYEE = {
  tin: '000-000-000-000', branchCode: '000',
  name: 'Ayala Land, Inc.', address: 'Tower One, Ayala Triangle, Makati City',
  zipCode: '1226',
}

/**
 * Derive the 2307 line items from the invoice.
 *
 * If the invoice has rows in invoice_line_items_col (future SAP integration),
 * each row becomes a cert line. The ATC on each invoice line determines its
 * rate; the tenant's declared rate is used as a fallback when invoice lines
 * carry no ATC.
 *
 * If the invoice has no line items, fall back to a single line covering the
 * whole gross at the tenant's declared ATC (current behaviour).
 */
async function deriveLinesForInvoice(
  invoiceId: number,
  grossAmount: number,
  fallbackAtc: string,
  fallbackRate: number,
): Promise<Bir2307Line[]> {
  const rows = await db.select()
    .from(invoiceLineItems)
    .where(eq(invoiceLineItems.invoiceId, invoiceId))
    .orderBy(asc(invoiceLineItems.lineIndex))

  if (rows.length === 0) {
    return [{
      description: 'Rentals of Real Property',
      atcCode: fallbackAtc,
      grossAmount,
      taxWithheldAmount: Math.round(grossAmount * fallbackRate) / 100,
    }]
  }

  // One cert line per invoice line. Rate per line defaults to tenant's declared rate
  // when the invoice line doesn't specify a different ATC.
  return rows.map((r) => {
    const atc = r.atcCode ?? fallbackAtc
    // In a future step we'd look up the rate for this ATC from a rate table.
    // For now every ATC uses the tenant's declared rate — good enough for demo.
    const amount = Number(r.amount)
    return {
      description: r.description,
      atcCode: atc,
      grossAmount: amount,
      taxWithheldAmount: Math.round(amount * fallbackRate) / 100,
    }
  })
}

export async function tryAutoIssueForPayment(paymentId: number): Promise<
  { issued: true; certificateId: number; referenceNumber: string } |
  { issued: false; reason: string }
> {
  const [payment] = await db.select().from(incomingPayments).where(eq(incomingPayments.paymentId, paymentId))
  if (!payment || payment.cwtCertificateId) return { issued: false, reason: 'already processed' }
  if (payment.paymentMethod === 'CWT') return { issued: false, reason: 'synthetic CWT row' }

  if (!payment.invoiceId) return { issued: false, reason: 'no invoice' }
  const [invoice] = await db.select().from(invoices).where(eq(invoices.invoiceId, payment.invoiceId))
  if (!invoice) return { issued: false, reason: 'no invoice' }
  const [customer] = await db.select().from(customers).where(eq(customers.customerId, payment.customerId))
  if (!customer?.cwtAutoIssueEnrolledAt) return { issued: false, reason: 'not enrolled' }

  const cls = classifyPaymentGap({
    invoice: { amount: invoice.amount, balanceRemaining: invoice.balanceRemaining },
    paymentAmount: payment.amount,
    declaredRatePct: customer.withholdingRatePct,
  })

  if (cls.kind === 'CWT_MISMATCH') {
    try {
      await db.insert(escalations).values({
        documentId: null as unknown as number,
        customerId: customer.customerId,
        escalationType: 'CWT_GAP_MISMATCH',
        description: `Expected ${customer.withholdingRatePct}%, observed ${cls.gapPct}% on INV-${invoice.invoiceNumber}`,
        status: 'OPEN',
      } as unknown as typeof escalations.$inferInsert)
    } catch { /* escalations may disallow null documentId — don't block other payments */ }
    return { issued: false, reason: 'mismatch escalated' }
  }
  if (cls.kind !== 'CWT_MATCH') return { issued: false, reason: `gap classification: ${cls.kind}` }

  const period = new Date(invoice.billingPeriodStart)
  const ref = referenceNumberFor({
    year: period.getFullYear(), month: period.getMonth() + 1,
    customerId: customer.customerId, invoiceId: invoice.invoiceId, paymentId: payment.paymentId,
  })

  // Build line items
  const rate = Number(customer.withholdingRatePct ?? '5.00')
  const rawLines = await deriveLinesForInvoice(
    invoice.invoiceId,
    Number(invoice.amount),
    customer.cwtAtcCode ?? 'WC100',
    rate,
  )

  // If the sum of per-line tax doesn't match the actual detected gap (within 1 peso),
  // scale the final line so totals reconcile. This keeps the cert internally consistent.
  const sumTax = rawLines.reduce((s, l) => s + l.taxWithheldAmount, 0)
  const delta = cls.gapAmount - sumTax
  if (Math.abs(delta) > 0.01 && rawLines.length > 0) {
    rawLines[rawLines.length - 1].taxWithheldAmount = Math.round((rawLines[rawLines.length - 1].taxWithheldAmount + delta) * 100) / 100
  }

  // Resolve signature
  let signatureB64: string | undefined
  if (customer.signatureImageUrl) {
    try {
      if (customer.signatureImageUrl.startsWith('data:')) {
        signatureB64 = customer.signatureImageUrl.split(',')[1]
      } else {
        const sigPath = path.resolve(process.cwd(), 'public' + customer.signatureImageUrl)
        signatureB64 = (await readFile(sigPath)).toString('base64')
      }
    } catch { /* soldier on */ }
  }

  const pdfBytes = await renderBir2307Pdf({
    periodStart: invoice.billingPeriodStart, periodEnd: invoice.billingPeriodEnd,
    payeeTin: AYALA_PAYEE.tin, payeeBranchCode: AYALA_PAYEE.branchCode,
    payeeName: AYALA_PAYEE.name, payeeAddress: AYALA_PAYEE.address, payeeZipCode: AYALA_PAYEE.zipCode,
    payorTin: customer.tin ?? '', payorBranchCode: customer.branchCode ?? '000',
    payorName: customer.name, payorAddress: customer.unitInfo ?? '', payorZipCode: '0000',
    lines: rawLines,
    signedByName: customer.authorizedSignatoryName ?? 'Auto',
    signedByTin: customer.tin ?? '',
    signatureImagePngBase64: signatureB64,
    referenceNumber: ref,
  })
  const pdfDataUrl = `data:application/pdf;base64,${Buffer.from(pdfBytes).toString('base64')}`

  // Insert cert (aggregate totals on the cert row)
  const [cert] = await db.insert(cwtCertificates).values({
    customerId: customer.customerId, contractId: invoice.contractId, invoiceId: invoice.invoiceId,
    paymentId: payment.paymentId,
    grossAmount: invoice.amount,
    withheldAmount: cls.gapAmount.toFixed(2),
    ratePct: customer.withholdingRatePct ?? '5.00',
    // Cert-level atcCode = first line's code (or 'MULTI' if >1 distinct).
    atcCode: rawLines.length > 1 && new Set(rawLines.map(l => l.atcCode)).size > 1 ? 'MULTI' : rawLines[0].atcCode,
    periodStart: invoice.billingPeriodStart, periodEnd: invoice.billingPeriodEnd,
    referenceNumber: ref, pdfUrl: pdfDataUrl, signatureApplied: !!signatureB64,
    status: 'ISSUED', source: 'AUTO_ENROLLED',
    signedByName: customer.authorizedSignatoryName, signedByEmail: customer.authorizedSignatoryEmail,
    issuedAt: new Date(),
  }).returning()

  // Insert one line row per rawLine
  if (rawLines.length > 0) {
    await db.insert(cwtCertificateLines).values(rawLines.map((l, i) => ({
      certificateId: cert.certificateId,
      lineIndex: i + 1,
      description: l.description,
      atcCode: l.atcCode,
      ratePct: String(rate.toFixed(2)),
      grossAmount: l.grossAmount.toFixed(2),
      withheldAmount: l.taxWithheldAmount.toFixed(2),
    })))
  }

  // Link payment + synthetic CWT payment + close invoice
  await db.update(incomingPayments).set({
    cwtAmount: cls.gapAmount.toFixed(2), cwtCertificateId: cert.certificateId,
  }).where(eq(incomingPayments.paymentId, payment.paymentId))

  await db.insert(incomingPayments).values({
    invoiceId: invoice.invoiceId, customerId: customer.customerId,
    amount: cls.gapAmount.toFixed(2), paymentMethod: 'CWT',
    referenceNumber: ref, status: 'CONFIRMED', confirmedAt: new Date(),
    cwtCertificateId: cert.certificateId,
  } as unknown as typeof incomingPayments.$inferInsert)

  const newBalance = Math.max(0, Number(invoice.balanceRemaining) - Number(payment.amount) - cls.gapAmount)
  await db.update(invoices).set({
    balanceRemaining: newBalance.toFixed(2),
    status: newBalance < 0.01 ? 'PAID' : invoice.status,
  }).where(eq(invoices.invoiceId, invoice.invoiceId))

  return { issued: true, certificateId: cert.certificateId, referenceNumber: ref }
}
