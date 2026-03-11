import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { documents, customers, invoices } from '@/db/schema'
import { eq } from 'drizzle-orm'

// GET /api/documents/[id] — return a single document with full OCR and validation results
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const documentId = Number(id)
    if (isNaN(documentId)) {
      return NextResponse.json({ error: 'Invalid document id' }, { status: 400 })
    }

    const rows = await db
      .select({
        document_id: documents.documentId,
        customer_id: documents.customerId,
        customer_name: customers.name,
        invoice_id: documents.invoiceId,
        invoice_number: invoices.invoiceNumber,
        file_name: documents.fileName,
        file_type: documents.fileType,
        ocr_status: documents.ocrStatus,
        ocr_result: documents.ocrResult,
        validation_result: documents.validationResult,
        uploaded_at: documents.uploadedAt,
      })
      .from(documents)
      .innerJoin(customers, eq(documents.customerId, customers.customerId))
      .leftJoin(invoices, eq(documents.invoiceId, invoices.invoiceId))
      .where(eq(documents.documentId, documentId))
      .limit(1)

    if (!rows.length) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    return NextResponse.json(rows[0])
  } catch (error) {
    console.error('Failed to fetch document:', error)
    return NextResponse.json({ error: 'Failed to fetch document' }, { status: 500 })
  }
}
