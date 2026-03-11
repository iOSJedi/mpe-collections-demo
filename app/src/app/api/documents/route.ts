import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth-middleware'
import { db } from '@/db'
import { documents, customers, invoices } from '@/db/schema'
import { eq, and } from 'drizzle-orm'

// POST /api/documents — upload a payment proof document
// Accepts multipart form data: file, customerId, invoiceId
// Stores file as Base64 in file_url for demo purposes
export const POST = withAuth(async (request: NextRequest) => {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const customerId = formData.get('customerId')
    const invoiceId = formData.get('invoiceId')

    if (!file) {
      return NextResponse.json({ error: 'file is required' }, { status: 400 })
    }
    if (!customerId) {
      return NextResponse.json({ error: 'customerId is required' }, { status: 400 })
    }

    const customerIdNum = Number(customerId)
    if (isNaN(customerIdNum)) {
      return NextResponse.json({ error: 'customerId must be a number' }, { status: 400 })
    }

    const invoiceIdNum = invoiceId ? Number(invoiceId) : null
    if (invoiceId && isNaN(invoiceIdNum!)) {
      return NextResponse.json({ error: 'invoiceId must be a number' }, { status: 400 })
    }

    // Read file as Base64 for demo storage
    const arrayBuffer = await file.arrayBuffer()
    const base64 = Buffer.from(arrayBuffer).toString('base64')
    const fileUrl = `data:${file.type};base64,${base64}`

    const [doc] = await db
      .insert(documents)
      .values({
        customerId: customerIdNum,
        invoiceId: invoiceIdNum,
        fileUrl,
        fileName: file.name,
        fileType: file.type,
        ocrStatus: 'PENDING',
      })
      .returning()

    return NextResponse.json(doc, { status: 201 })
  } catch (error) {
    console.error('Failed to upload document:', error)
    return NextResponse.json({ error: 'Failed to upload document' }, { status: 500 })
  }
})

// GET /api/documents — list documents with optional filters
// Query params: customerId, ocrStatus
export const GET = withAuth(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url)
    const customerIdParam = searchParams.get('customerId')
    const ocrStatusParam = searchParams.get('ocrStatus')

    const conditions = []
    if (customerIdParam) {
      conditions.push(eq(documents.customerId, Number(customerIdParam)))
    }
    if (ocrStatusParam) {
      conditions.push(eq(documents.ocrStatus, ocrStatusParam))
    }

    const rows = await db
      .select({
        document_id: documents.documentId,
        customer_name: customers.name,
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
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(documents.uploadedAt)

    return NextResponse.json(rows)
  } catch (error) {
    console.error('Failed to list documents:', error)
    return NextResponse.json({ error: 'Failed to list documents' }, { status: 500 })
  }
})
