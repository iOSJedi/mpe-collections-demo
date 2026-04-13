import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth-middleware'
import { db } from '@/db'
import { documents, customers, invoices } from '@/db/schema'
import { eq, and, sql } from 'drizzle-orm'

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

    // Use raw SQL to avoid pg-proxy column ordering issues and handle JSONB properly
    const whereParts: string[] = []
    if (customerIdParam) whereParts.push(`d.customer_id = ${Number(customerIdParam)}`)
    if (ocrStatusParam) whereParts.push(`d.ocr_status = '${ocrStatusParam.replace(/'/g, "''")}'`)
    const whereClause = whereParts.length > 0 ? `WHERE ${whereParts.join(' AND ')}` : ''

    const result = await db.execute(sql.raw(`SELECT d.document_id, c.name as customer_name, i.invoice_number, d.payment_id, d.file_url, d.file_name, d.file_type, d.ocr_status, d.ocr_result, d.validation_result, d.uploaded_at FROM documents_col d JOIN customers_col c ON c.customer_id = d.customer_id LEFT JOIN invoices_col i ON i.invoice_id = d.invoice_id ${whereClause} ORDER BY d.uploaded_at`))
    const rows = (result as unknown as any[]).map(r => {
      // Parse JSONB fields that may be double-encoded strings from the proxy
      let ocr = r.ocr_result
      if (typeof ocr === 'string') { try { ocr = JSON.parse(ocr) } catch {} }
      if (typeof ocr === 'string') { try { ocr = JSON.parse(ocr) } catch {} }
      let val = r.validation_result
      if (typeof val === 'string') { try { val = JSON.parse(val) } catch {} }
      if (typeof val === 'string') { try { val = JSON.parse(val) } catch {} }
      return {
        document_id: r.document_id,
        customer_name: r.customer_name,
        invoice_number: r.invoice_number,
        payment_id: r.payment_id,
        file_url: r.file_url,
        file_name: r.file_name,
        file_type: r.file_type,
        ocr_status: r.ocr_status,
        ocr_result: ocr,
        validation_result: val,
        uploaded_at: String(r.uploaded_at ?? ''),
      }
    })

    return NextResponse.json(rows)
  } catch (error) {
    console.error('Failed to list documents:', error)
    return NextResponse.json({ error: 'Failed to list documents' }, { status: 500 })
  }
})
