import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { customers, invoices, cwtCertificates, escalations } from '@/db/schema'
import { and, eq, between } from 'drizzle-orm'
import { extract2307 } from '@/lib/cwt/ocr'
import { withAuth } from '@/lib/auth-middleware'

export const POST = withAuth(async (req: NextRequest) => {
  const { pdfBase64 } = await req.json()
  const extracted = await extract2307(pdfBase64)
  if (!extracted.payorTin || !extracted.taxWithheldAmount) {
    return NextResponse.json({ matched: false, extracted, reason: 'missing required fields' })
  }

  const [tenant] = await db.select().from(customers).where(eq(customers.tin, extracted.payorTin)).limit(1)
  if (!tenant) return NextResponse.json({ matched: false, extracted, reason: 'no tenant with that TIN' })

  const candidateInvoices = await db.select().from(invoices).where(and(
    eq(invoices.customerId, tenant.customerId),
    between(invoices.billingPeriodEnd, extracted.periodStart ?? '1970-01-01', extracted.periodEnd ?? '2100-01-01'),
  )).limit(5)
  const unique = candidateInvoices.filter(inv =>
    Math.abs(Number(inv.amount) * 0.05 - (extracted.taxWithheldAmount ?? 0)) < 1
  )
  if (unique.length !== 1) {
    // TODO: handle doc-less escalations — documentId FK currently set to 0 (no BIR 2307 document row exists yet)
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
