import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth-middleware'
import { db } from '@/db'
import { suppliers, supplierInvoices, purchaseOrders, threeWayMatches } from '@/db/schema'
import { eq, ilike, sql, and } from 'drizzle-orm'
import type { SupplierSummary } from '@/types'
import { cachedJson, getFromCache, setInCache } from '@/lib/cache'

export const GET = withAuth(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type')
    const category = searchParams.get('category')
    const search = searchParams.get('search')
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))
    const limit = Math.min(200, Math.max(1, parseInt(searchParams.get('limit') ?? '50', 10)))
    const offset = (page - 1) * limit

    const cacheKey = `payable-list-${page}-${limit}-${search ?? ''}-${type ?? ''}-${category ?? ''}`
    const cached = getFromCache(cacheKey)
    if (cached) return cachedJson(cached, 30, 60)

    const conditions = []

    if (type) {
      conditions.push(eq(suppliers.type, type))
    }

    if (category) {
      conditions.push(eq(suppliers.category, category))
    }

    if (search) {
      conditions.push(ilike(suppliers.name, `%${search}%`))
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined

    const rows = await db
      .select({
        supplier_id: suppliers.supplierId,
        name: suppliers.name,
        category: suppliers.category,
        type: suppliers.type,
        status: suppliers.status,
        total_payable: sql<string>`COALESCE(SUM(CASE WHEN ${supplierInvoices.paymentStatus} != 'PAID' THEN (${supplierInvoices.amount}::numeric - ${supplierInvoices.amountPaid}::numeric) ELSE 0 END), 0)`,
        open_pos: sql<string>`COUNT(DISTINCT CASE WHEN ${purchaseOrders.status} = 'OPEN' THEN ${purchaseOrders.poId} END)`,
        blocked_invoices: sql<string>`COUNT(DISTINCT CASE WHEN ${threeWayMatches.matchStatus} = 'MISMATCH' THEN ${threeWayMatches.matchId} END)`,
      })
      .from(suppliers)
      .leftJoin(supplierInvoices, eq(supplierInvoices.supplierId, suppliers.supplierId))
      .leftJoin(purchaseOrders, eq(purchaseOrders.supplierId, suppliers.supplierId))
      .leftJoin(threeWayMatches, eq(threeWayMatches.supplierId, suppliers.supplierId))
      .where(whereClause)
      .groupBy(
        suppliers.supplierId,
        suppliers.name,
        suppliers.category,
        suppliers.type,
        suppliers.status,
      )
      .orderBy(suppliers.name)
      .limit(limit)
      .offset(offset)

    const result: SupplierSummary[] = rows.map((r) => ({
      supplier_id: r.supplier_id,
      name: r.name,
      category: r.category,
      type: r.type,
      status: r.status,
      total_payable: Number(r.total_payable),
      open_pos: Number(r.open_pos),
      blocked_invoices: Number(r.blocked_invoices),
    }))

    setInCache(cacheKey, result, 30_000)
    return cachedJson(result, 30, 60)
  } catch (error) {
    console.error('Failed to fetch suppliers:', error)
    return NextResponse.json({ error: 'Failed to fetch suppliers' }, { status: 500 })
  }
})
