import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth-middleware'
import { db } from '@/db'
import { invoices, customers, delinquencyScores, incomingPayments } from '@/db/schema'
import { eq, inArray, sql, desc } from 'drizzle-orm'
import type { WorklistItem } from '@/types'
import { cachedJson, getFromCache, setInCache } from '@/lib/cache'

// GET /api/collections/worklist
// Returns invoices grouped by customer_id where status IN ('OVERDUE','PARTIAL')
// Joined with delinquency_scores for risk_level, incoming_payments for last payment date
// Sorted by total_overdue DESC
export const GET = withAuth(async (_request: NextRequest) => {
  const cacheKey = 'collections-worklist'
  const cached = getFromCache(cacheKey)
  if (cached) return cachedJson(cached, 30, 60)

  try {
    const rows = await db
      .select({
        customer_id: customers.customerId,
        account_number: customers.accountNumber,
        name: customers.name,
        type: customers.type,
        total_overdue: sql<string>`COALESCE(SUM(${invoices.balanceRemaining}::numeric), 0)`,
        oldest_invoice_date: sql<string>`MIN(${invoices.dueDate})`,
        days_overdue: sql<number>`GREATEST(0, EXTRACT(DAY FROM NOW() - MIN(${invoices.dueDate}))::int)`,
        risk_level: delinquencyScores.riskLevel,
        last_payment_date: sql<string | null>`MAX(${incomingPayments.paymentDate})`,
      })
      .from(invoices)
      .innerJoin(customers, eq(invoices.customerId, customers.customerId))
      .leftJoin(delinquencyScores, eq(delinquencyScores.customerId, customers.customerId))
      .leftJoin(incomingPayments, eq(incomingPayments.customerId, customers.customerId))
      .where(inArray(invoices.status, ['OVERDUE', 'PARTIAL']))
      .groupBy(
        customers.customerId,
        customers.accountNumber,
        customers.name,
        customers.type,
        delinquencyScores.riskLevel,
      )
      .orderBy(desc(sql`COALESCE(SUM(${invoices.balanceRemaining}::numeric), 0)`))

    const result: WorklistItem[] = rows.map((r) => ({
      customer_id: r.customer_id,
      account_number: r.account_number,
      name: r.name,
      type: r.type,
      total_overdue: Number(r.total_overdue),
      oldest_invoice_date: r.oldest_invoice_date,
      risk_level: r.risk_level ?? null,
      last_payment_date: r.last_payment_date ? String(r.last_payment_date) : null,
      days_overdue: Number(r.days_overdue),
    }))

    setInCache(cacheKey, result, 30_000)
    return cachedJson(result, 30, 60)
  } catch (error) {
    console.error('Failed to fetch collections worklist:', error)
    return NextResponse.json({ error: 'Failed to fetch collections worklist' }, { status: 500 })
  }
})
