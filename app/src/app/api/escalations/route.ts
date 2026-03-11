import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth-middleware'
import { db } from '@/db'
import { escalations, customers, documents, invoices } from '@/db/schema'
import { eq } from 'drizzle-orm'
import type { EscalationRecord } from '@/types'

// GET /api/escalations
// List escalation records joined with customer name, document file_name, invoice number
// Optional query param: status
export const GET = withAuth(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url)
    const statusParam = searchParams.get('status')

    const query = db
      .select({
        escalation_id: escalations.escalationId,
        document_id: escalations.documentId,
        customer_name: customers.name,
        file_name: documents.fileName,
        invoice_number: invoices.invoiceNumber,
        type: escalations.type,
        description: escalations.description,
        ai_analysis: escalations.aiAnalysis,
        status: escalations.status,
        assigned_to: escalations.assignedTo,
        resolution_notes: escalations.resolutionNotes,
        created_at: escalations.createdAt,
        resolved_at: escalations.resolvedAt,
      })
      .from(escalations)
      .innerJoin(customers, eq(escalations.customerId, customers.customerId))
      .innerJoin(documents, eq(escalations.documentId, documents.documentId))
      .leftJoin(invoices, eq(escalations.invoiceId, invoices.invoiceId))

    const rows = statusParam
      ? await query.where(eq(escalations.status, statusParam))
      : await query

    const result: EscalationRecord[] = rows.map((r) => ({
      escalation_id: r.escalation_id,
      document_id: r.document_id,
      customer_name: r.customer_name,
      file_name: r.file_name,
      invoice_number: r.invoice_number ?? null,
      type: r.type,
      description: r.description,
      ai_analysis: r.ai_analysis as Record<string, unknown> | null,
      status: r.status,
      assigned_to: r.assigned_to ?? null,
      resolution_notes: r.resolution_notes ?? null,
      created_at: r.created_at ? String(r.created_at) : '',
      resolved_at: r.resolved_at ? String(r.resolved_at) : null,
    }))

    return NextResponse.json(result)
  } catch (error) {
    console.error('Failed to fetch escalations:', error)
    return NextResponse.json({ error: 'Failed to fetch escalations' }, { status: 500 })
  }
})
