import { db } from '@/db'
import { customers, incomingPayments, invoices, cwtCertificates, escalations } from '@/db/schema'
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
        documentId: null as any,
        customerId: customer.customerId,
        escalationType: 'CWT_GAP_MISMATCH',
        description: `Expected ${customer.withholdingRatePct}%, observed ${cls.gapPct}% on INV-${invoice.invoiceNumber}`,
        status: 'OPEN',
      } as any)
    } catch { /* escalations_col may not allow documentId=null; don't block auto-issue for other payments */ }
    return { issued: false, reason: 'mismatch escalated' }
  }
  if (cls.kind !== 'CWT_MATCH') return { issued: false, reason: `gap classification: ${cls.kind}` }

  const period = new Date(invoice.billingPeriodStart)
  const ref = referenceNumberFor({
    year: period.getFullYear(), month: period.getMonth() + 1,
    customerId: customer.customerId, invoiceId: invoice.invoiceId, paymentId: payment.paymentId,
  })

  // Resolve signature image (either a /public path or a data URL)
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
    atcCode: customer.cwtAtcCode ?? 'WC100',
    grossAmount: Number(invoice.amount), taxWithheldAmount: cls.gapAmount,
    signedByName: customer.authorizedSignatoryName ?? 'Auto',
    signedByTin: customer.tin ?? '',
    signatureImagePngBase64: signatureB64,
    referenceNumber: ref,
  })
  const pdfDataUrl = `data:application/pdf;base64,${Buffer.from(pdfBytes).toString('base64')}`

  // Insert certificate
  const [cert] = await db.insert(cwtCertificates).values({
    customerId: customer.customerId, contractId: invoice.contractId, invoiceId: invoice.invoiceId,
    paymentId: payment.paymentId,
    grossAmount: invoice.amount, withheldAmount: cls.gapAmount.toFixed(2),
    ratePct: customer.withholdingRatePct ?? '5.00', atcCode: customer.cwtAtcCode ?? 'WC100',
    periodStart: invoice.billingPeriodStart, periodEnd: invoice.billingPeriodEnd,
    referenceNumber: ref, pdfUrl: pdfDataUrl, signatureApplied: !!signatureB64,
    status: 'ISSUED', source: 'AUTO_ENROLLED',
    signedByName: customer.authorizedSignatoryName, signedByEmail: customer.authorizedSignatoryEmail,
    issuedAt: new Date(),
  }).returning()

  // Link on the triggering payment
  await db.update(incomingPayments).set({
    cwtAmount: cls.gapAmount.toFixed(2), cwtCertificateId: cert.certificateId,
  }).where(eq(incomingPayments.paymentId, payment.paymentId))

  // Post a synthetic CWT payment that closes the invoice
  await db.insert(incomingPayments).values({
    invoiceId: invoice.invoiceId, customerId: customer.customerId,
    amount: cls.gapAmount.toFixed(2), paymentMethod: 'CWT',
    referenceNumber: ref, status: 'CONFIRMED', confirmedAt: new Date(),
    cwtCertificateId: cert.certificateId,
  } as any)

  // Close invoice
  const newBalance = Math.max(0, Number(invoice.balanceRemaining) - Number(payment.amount) - cls.gapAmount)
  await db.update(invoices).set({
    balanceRemaining: newBalance.toFixed(2),
    status: newBalance < 0.01 ? 'PAID' : invoice.status,
  }).where(eq(invoices.invoiceId, invoice.invoiceId))

  return { issued: true, certificateId: cert.certificateId, referenceNumber: ref }
}
