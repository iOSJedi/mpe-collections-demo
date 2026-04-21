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
  signatureDataUrl: string
  tinProofDataUrl: string
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
