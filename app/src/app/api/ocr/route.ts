import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth-middleware'
import { db } from '@/db'
import { documents, escalations, invoices, customers, incomingPayments } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { extractPaymentDetails } from '@/lib/ocr'
import { validateDocument } from '@/lib/validation'

// POST /api/ocr — trigger OCR + validation for a document
// Body: { documentId: number }
export const POST = withAuth(async (request: NextRequest) => {
  try {
    const body = await request.json()
    const { documentId } = body

    if (!documentId) {
      return NextResponse.json({ error: 'documentId is required' }, { status: 400 })
    }

    const documentIdNum = Number(documentId)
    if (isNaN(documentIdNum)) {
      return NextResponse.json({ error: 'documentId must be a number' }, { status: 400 })
    }

    // Fetch document record
    const [doc] = await db
      .select()
      .from(documents)
      .where(eq(documents.documentId, documentIdNum))
      .limit(1)

    if (!doc) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    // Extract base64 payload from the stored data URI
    const dataUriMatch = doc.fileUrl.match(/^data:([^;]+);base64,(.+)$/)
    if (!dataUriMatch) {
      return NextResponse.json({ error: 'Document file data is not in expected base64 format' }, { status: 422 })
    }
    const mimeType = dataUriMatch[1]
    const imageBase64 = dataUriMatch[2]

    // Run OCR via Gemini
    const ocrResult = await extractPaymentDetails(imageBase64, mimeType)

    // Fetch invoice context if document is linked to an invoice
    let validationResult = null

    if (doc.invoiceId) {
      const [invoiceRow] = await db
        .select({
          invoiceNumber: invoices.invoiceNumber,
          amount: invoices.amount,
          balanceRemaining: invoices.balanceRemaining,
          dueDate: invoices.dueDate,
          issuedAt: invoices.issuedAt,
          customerId: invoices.customerId,
          customerName: customers.name,
        })
        .from(invoices)
        .innerJoin(customers, eq(invoices.customerId, customers.customerId))
        .where(eq(invoices.invoiceId, doc.invoiceId))
        .limit(1)

      if (invoiceRow) {
        // Collect all existing reference numbers to check for duplicates
        const existingPayments = await db
          .select({ referenceNumber: incomingPayments.referenceNumber })
          .from(incomingPayments)
          .where(eq(incomingPayments.invoiceId, doc.invoiceId))

        const existingReferenceNumbers = existingPayments
          .map(p => p.referenceNumber)
          .filter((r): r is string => r !== null)

        const invoiceContext = {
          invoiceNumber: invoiceRow.invoiceNumber,
          amount: Number(invoiceRow.amount),
          balanceRemaining: Number(invoiceRow.balanceRemaining),
          dueDate: invoiceRow.dueDate,
          customerName: invoiceRow.customerName,
          issuedAt: invoiceRow.issuedAt ? invoiceRow.issuedAt.toISOString() : new Date().toISOString(),
        }

        validationResult = validateDocument(
          ocrResult,
          invoiceContext,
          invoiceRow.customerName,
          existingReferenceNumbers
        )

        // Create an escalation if validation failed
        if (!validationResult.is_valid) {
          const criticalChecks = validationResult.checks.filter(c => !c.passed && c.severity === 'critical')
          const warningChecks = validationResult.checks.filter(c => !c.passed && c.severity === 'warning')

          const escalationType = criticalChecks.length > 0 ? 'VALIDATION_FAILED' : 'VALIDATION_WARNING'
          const failedChecks = [...criticalChecks, ...warningChecks]
          const description = failedChecks
            .map(c => `${c.check}: expected "${c.expected}", got "${c.actual}"`)
            .join('; ')

          await db.insert(escalations).values({
            documentId: documentIdNum,
            customerId: doc.customerId,
            invoiceId: doc.invoiceId,
            type: escalationType,
            description: description || 'Document validation failed',
            aiAnalysis: { ocrResult, validationResult },
            status: 'OPEN',
          })
        }
      }
    }

    // Update document with OCR + validation results
    const [updatedDoc] = await db
      .update(documents)
      .set({
        ocrResult,
        validationResult,
        ocrStatus: 'COMPLETED',
      })
      .where(eq(documents.documentId, documentIdNum))
      .returning()

    return NextResponse.json(updatedDoc)
  } catch (error) {
    // Mark document as FAILED if possible
    const body = await (async () => {
      try {
        return JSON.parse((error as { body?: string }).body ?? '{}')
      } catch {
        return {}
      }
    })()
    void body

    console.error('Failed to run OCR:', error)
    return NextResponse.json({ error: 'Failed to run OCR' }, { status: 500 })
  }
})
