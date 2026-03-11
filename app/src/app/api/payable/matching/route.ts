import { NextRequest, NextResponse } from 'next/server'
import { withAuth, AuthenticatedUser } from '@/lib/auth-middleware'
import { db } from '@/db'
import { threeWayMatches, purchaseOrders, suppliers, supplierInvoices } from '@/db/schema'
import { eq, ilike, and, desc } from 'drizzle-orm'
import type { ThreeWayMatchRow } from '@/types'

export const GET = withAuth(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url)
    const matchStatus = searchParams.get('match_status')
    const supplierId = searchParams.get('supplier_id')
    const search = searchParams.get('search')

    const conditions = []

    if (matchStatus) {
      conditions.push(eq(threeWayMatches.matchStatus, matchStatus))
    }

    if (supplierId) {
      const id = parseInt(supplierId, 10)
      if (!isNaN(id)) {
        conditions.push(eq(threeWayMatches.supplierId, id))
      }
    }

    if (search) {
      conditions.push(ilike(suppliers.name, `%${search}%`))
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined

    const rows = await db
      .select({
        match_id: threeWayMatches.matchId,
        po_number: purchaseOrders.poNumber,
        supplier_name: suppliers.name,
        project_name: purchaseOrders.projectName,
        po_amount: threeWayMatches.poAmount,
        receipt_amount: threeWayMatches.receiptAmount,
        invoice_amount: threeWayMatches.invoiceAmount,
        match_status: threeWayMatches.matchStatus,
        payment_status: supplierInvoices.paymentStatus,
        discrepancies: threeWayMatches.discrepancies,
        ai_notes: threeWayMatches.aiNotes,
        // For MatchDetail panel
        po_id: purchaseOrders.poId,
        supplier_invoice_id: supplierInvoices.supplierInvoiceId,
        receipt_id: threeWayMatches.receiptId,
        po_description: purchaseOrders.description,
        po_issued_date: purchaseOrders.issuedDate,
        invoice_number: supplierInvoices.invoiceNumber,
        invoice_submitted_date: supplierInvoices.submittedDate,
        invoice_due_date: supplierInvoices.dueDate,
        reviewed_by: threeWayMatches.reviewedBy,
        reviewed_at: threeWayMatches.reviewedAt,
        created_at: threeWayMatches.createdAt,
      })
      .from(threeWayMatches)
      .leftJoin(purchaseOrders, eq(purchaseOrders.poId, threeWayMatches.poId))
      .leftJoin(suppliers, eq(suppliers.supplierId, threeWayMatches.supplierId))
      .leftJoin(supplierInvoices, eq(supplierInvoices.supplierInvoiceId, threeWayMatches.supplierInvoiceId))
      .where(whereClause)
      .orderBy(desc(threeWayMatches.createdAt))

    const result: ThreeWayMatchRow[] = rows.map((r) => ({
      match_id: r.match_id,
      po_number: r.po_number ?? '',
      supplier_name: r.supplier_name ?? '',
      project_name: r.project_name ?? '',
      po_amount: Number(r.po_amount),
      receipt_amount: Number(r.receipt_amount),
      invoice_amount: Number(r.invoice_amount),
      match_status: r.match_status,
      payment_status: r.payment_status ?? 'UNPAID',
      discrepancies: (r.discrepancies as ThreeWayMatchRow['discrepancies']) ?? null,
      ai_notes: r.ai_notes ?? null,
      // Extended fields for detail panel
      po_id: r.po_id ?? undefined,
      supplier_invoice_id: r.supplier_invoice_id ?? undefined,
      receipt_id: r.receipt_id ?? undefined,
      po_description: r.po_description ?? null,
      po_issued_date: r.po_issued_date ? String(r.po_issued_date) : null,
      invoice_number: r.invoice_number ?? null,
      invoice_submitted_date: r.invoice_submitted_date ? String(r.invoice_submitted_date) : null,
      invoice_due_date: r.invoice_due_date ? String(r.invoice_due_date) : null,
    } as ThreeWayMatchRow)
    )

    return NextResponse.json(result)
  } catch (error) {
    console.error('Failed to fetch three-way matches:', error)
    return NextResponse.json({ error: 'Failed to fetch matches' }, { status: 500 })
  }
})

export const PATCH = withAuth(async (request: NextRequest, user: AuthenticatedUser) => {
  try {
    const body = await request.json()
    const { matchId, action } = body as { matchId: number; action: 'APPROVE' | 'BLOCK' }

    if (!matchId || !action) {
      return NextResponse.json({ error: 'matchId and action are required' }, { status: 400 })
    }

    if (action !== 'APPROVE' && action !== 'BLOCK') {
      return NextResponse.json({ error: 'action must be APPROVE or BLOCK' }, { status: 400 })
    }

    const newStatus = action === 'APPROVE' ? 'FULL_MATCH' : 'BLOCKED'

    await db
      .update(threeWayMatches)
      .set({
        matchStatus: newStatus,
        reviewedBy: user.email ?? user.uid,
        reviewedAt: new Date(),
      })
      .where(eq(threeWayMatches.matchId, matchId))

    return NextResponse.json({ success: true, matchId, newStatus })
  } catch (error) {
    console.error('Failed to update match:', error)
    return NextResponse.json({ error: 'Failed to update match' }, { status: 500 })
  }
})
