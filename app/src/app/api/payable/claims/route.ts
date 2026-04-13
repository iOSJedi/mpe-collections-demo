import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth-middleware'
import { db } from '@/db'
import { supplierInvoices, suppliers, purchaseOrders, goodsReceipts, threeWayMatches, apWorkflowEvents } from '@/db/schema'
import { eq, and, sql } from 'drizzle-orm'
import type { ClaimSummary, WorkflowStatus } from '@/types'
import type { AuthenticatedUser } from '@/lib/auth-middleware'
import { cachedJson, getFromCache, setInCache, invalidateCache } from '@/lib/cache'

export const GET = withAuth(async (request: NextRequest, user: AuthenticatedUser) => {
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const supplierIdParam = searchParams.get('supplierId')

    const cacheKey = `claims-list-${status ?? ''}-${supplierIdParam ?? ''}`
    const cached = getFromCache(cacheKey)
    if (cached) return cachedJson(cached, 15, 30)

    const conditions = []

    if (status) {
      conditions.push(eq(supplierInvoices.workflowStatus, status))
    }

    if (supplierIdParam) {
      const supplierId = parseInt(supplierIdParam, 10)
      if (!isNaN(supplierId)) {
        conditions.push(eq(supplierInvoices.supplierId, supplierId))
      }
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined

    const rows = await db
      .select({
        supplierInvoiceId: supplierInvoices.supplierInvoiceId,
        invoiceNumber: supplierInvoices.invoiceNumber,
        supplierId: supplierInvoices.supplierId,
        supplierName: suppliers.name,
        poId: supplierInvoices.poId,
        poNumber: purchaseOrders.poNumber,
        amount: supplierInvoices.amount,
        workflowStatus: supplierInvoices.workflowStatus,
        submittedDate: supplierInvoices.submittedDate,
        claimDocumentUrl: supplierInvoices.claimDocumentUrl,
        grVerified: sql<boolean>`EXISTS (
          SELECT 1 FROM goods_receipts_col gr
          WHERE gr.po_id = ${supplierInvoices.poId}
        )`,
        threeWayMatch: threeWayMatches.matchStatus,
      })
      .from(supplierInvoices)
      .leftJoin(suppliers, eq(suppliers.supplierId, supplierInvoices.supplierId))
      .leftJoin(purchaseOrders, eq(purchaseOrders.poId, supplierInvoices.poId))
      .leftJoin(threeWayMatches, eq(threeWayMatches.supplierInvoiceId, supplierInvoices.supplierInvoiceId))
      .where(whereClause)
      .orderBy(supplierInvoices.createdAt)

    const result: ClaimSummary[] = rows.map((r) => ({
      supplierInvoiceId: r.supplierInvoiceId,
      invoiceNumber: r.invoiceNumber,
      supplierName: r.supplierName ?? '',
      supplierId: r.supplierId,
      poNumber: r.poNumber ?? '',
      poId: r.poId,
      amount: Number(r.amount),
      workflowStatus: r.workflowStatus as WorkflowStatus,
      submittedDate: r.submittedDate,
      grVerified: Boolean(r.grVerified),
      threeWayMatch: r.threeWayMatch ?? null,
      claimDocumentUrl: r.claimDocumentUrl ?? null,
    }))

    setInCache(cacheKey, result, 15_000)
    return cachedJson(result, 15, 30)
  } catch (error) {
    console.error('Failed to fetch claims:', error)
    return NextResponse.json({ error: 'Failed to fetch claims' }, { status: 500 })
  }
})

export const POST = withAuth(async (request: NextRequest, user: AuthenticatedUser) => {
  try {
    const body = await request.json()
    const { supplierId, poId, invoiceNumber, amount } = body

    if (!supplierId || !poId || !invoiceNumber || amount === undefined) {
      return NextResponse.json({ error: 'Missing required fields: supplierId, poId, invoiceNumber, amount' }, { status: 400 })
    }

    // Look up the PO to validate it exists
    const [po] = await db
      .select({ poId: purchaseOrders.poId, projectName: purchaseOrders.projectName })
      .from(purchaseOrders)
      .where(eq(purchaseOrders.poId, poId))

    if (!po) {
      return NextResponse.json({ error: 'Purchase order not found' }, { status: 404 })
    }

    const today = new Date()
    const submittedDate = today.toISOString().split('T')[0]
    const dueDate = new Date(today)
    dueDate.setDate(dueDate.getDate() + 30)
    const dueDateStr = dueDate.toISOString().split('T')[0]

    // Insert the supplier invoice
    const [newInvoice] = await db
      .insert(supplierInvoices)
      .values({
        supplierId,
        poId,
        invoiceNumber,
        amount: String(amount),
        submittedDate,
        dueDate: dueDateStr,
        workflowStatus: 'SUBMITTED',
      })
      .returning()

    // Fire CLAIM_SUBMITTED event
    await db.insert(apWorkflowEvents).values({
      supplierInvoiceId: newInvoice.supplierInvoiceId,
      poId,
      eventType: 'CLAIM_SUBMITTED',
      eventData: { projectName: po.projectName },
      performedBy: user.email ?? user.uid,
      notes: null,
    })

    invalidateCache('claims-list')
    return NextResponse.json(newInvoice, { status: 201 })
  } catch (error) {
    console.error('Failed to submit claim:', error)
    return NextResponse.json({ error: 'Failed to submit claim' }, { status: 500 })
  }
})
