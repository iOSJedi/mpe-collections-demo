import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth-middleware'
import { db } from '@/db'
import { customers, invoices, delinquencyScores, payerSegments } from '@/db/schema'
import { eq, ilike, sql, and, ne } from 'drizzle-orm'
import type { CustomerSummary } from '@/types'
import { cachedJson, getFromCache, setInCache } from '@/lib/cache'

export const GET = withAuth(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type')
    const search = searchParams.get('search')
    const status = searchParams.get('status')
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))
    const limit = Math.min(200, Math.max(1, parseInt(searchParams.get('limit') ?? '50', 10)))
    const offset = (page - 1) * limit

    const cacheKey = `receivable-list-${page}-${limit}-${search ?? ''}-${status ?? ''}-${type ?? ''}`
    const cached = getFromCache(cacheKey)
    if (cached) return cachedJson(cached, 30, 60)

    const conditions = []

    if (type && (type === 'TENANT' || type === 'PROPERTY_MANAGER')) {
      conditions.push(eq(customers.type, type))
    }

    if (status) {
      conditions.push(eq(customers.status, status))
    }

    if (search) {
      conditions.push(ilike(customers.name, `%${search}%`))
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined

    const rows = await db
      .select({
        customer_id: customers.customerId,
        account_number: customers.accountNumber,
        type: customers.type,
        name: customers.name,
        business_type: customers.businessType,
        property_name: customers.propertyName,
        unit_info: customers.unitInfo,
        status: customers.status,
        total_receivable: sql<string>`COALESCE(SUM(CASE WHEN ${invoices.status} != 'PAID' THEN ${invoices.balanceRemaining}::numeric ELSE 0 END), 0)`,
        overdue_amount: sql<string>`COALESCE(SUM(CASE WHEN ${invoices.status} = 'OVERDUE' THEN ${invoices.balanceRemaining}::numeric ELSE 0 END), 0)`,
        delinquency_risk: delinquencyScores.riskLevel,
        segment_name: payerSegments.segmentName,
      })
      .from(customers)
      .leftJoin(invoices, eq(invoices.customerId, customers.customerId))
      .leftJoin(delinquencyScores, eq(delinquencyScores.customerId, customers.customerId))
      .leftJoin(payerSegments, eq(payerSegments.customerId, customers.customerId))
      .where(whereClause)
      .groupBy(
        customers.customerId,
        customers.accountNumber,
        customers.type,
        customers.name,
        customers.businessType,
        customers.propertyName,
        customers.unitInfo,
        customers.status,
        delinquencyScores.riskLevel,
        payerSegments.segmentName,
      )
      .orderBy(customers.name)
      .limit(limit)
      .offset(offset)

    const result: CustomerSummary[] = rows.map((r) => ({
      customer_id: r.customer_id,
      account_number: r.account_number,
      type: r.type as 'TENANT' | 'PROPERTY_MANAGER',
      name: r.name,
      business_type: r.business_type ?? null,
      property_name: r.property_name ?? null,
      unit_info: r.unit_info ?? null,
      status: r.status,
      total_receivable: Number(r.total_receivable),
      overdue_amount: Number(r.overdue_amount),
      delinquency_risk: r.delinquency_risk ?? null,
      segment_name: r.segment_name ?? null,
    }))

    setInCache(cacheKey, result, 30_000)
    return cachedJson(result, 30, 60)
  } catch (error) {
    console.error('Failed to fetch customers:', error)
    return NextResponse.json({ error: 'Failed to fetch customers' }, { status: 500 })
  }
})
