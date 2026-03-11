import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth-middleware'
import { db } from '@/db'
import { sql } from 'drizzle-orm'

export const GET = withAuth(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') || 'all'
    const segment = searchParams.get('segment') || ''
    const search = searchParams.get('search') || ''
    const limit = Math.min(Number(searchParams.get('limit')) || 50, 200)
    const offset = Number(searchParams.get('offset')) || 0

    // Build WHERE conditions using drizzle sql tagged templates
    const typeCondition =
      type === 'wholesale'
        ? sql`AND c.customer_type IN ('wholesale', 'both')`
        : type === 'retail'
          ? sql`AND c.customer_type = 'retail'`
          : type === 'both'
            ? sql`AND c.customer_type = 'both'`
            : sql``

    const segmentCondition = segment
      ? sql`AND cs.segment_name = ${segment}`
      : sql``

    const searchCondition = search
      ? sql`AND (
          c.first_name ILIKE ${'%' + search + '%'}
          OR c.last_name ILIKE ${'%' + search + '%'}
          OR c.business_name ILIKE ${'%' + search + '%'}
          OR c.customer_id ILIKE ${'%' + search + '%'}
        )`
      : sql``

    const [countResult, dataResult] = await Promise.all([
      db.execute(sql`
        SELECT COUNT(DISTINCT c.customer_id)::int AS total
        FROM customers c
        LEFT JOIN customer_segments cs ON cs.customer_id = c.customer_id
        WHERE 1=1
        ${typeCondition}
        ${segmentCondition}
        ${searchCondition}
      `),
      db.execute(sql`
        SELECT
          c.customer_id,
          c.customer_type,
          c.first_name,
          c.last_name,
          c.business_name,
          cs.segment_name,
          ch.risk_level AS churn_risk,
          COALESCE(agg.total_spend, 0) AS total_spend,
          COALESCE(agg.transaction_count, 0)::int AS transaction_count,
          agg.last_transaction_date
        FROM customers c
        LEFT JOIN customer_segments cs ON cs.customer_id = c.customer_id
        LEFT JOIN churn_scores ch ON ch.customer_id = c.customer_id
        LEFT JOIN (
          SELECT
            customer_id,
            SUM(total_amount::numeric) AS total_spend,
            COUNT(*) AS transaction_count,
            MAX(transaction_date) AS last_transaction_date
          FROM transactions
          GROUP BY customer_id
        ) agg ON agg.customer_id = c.customer_id
        WHERE 1=1
        ${typeCondition}
        ${segmentCondition}
        ${searchCondition}
        ORDER BY agg.total_spend DESC NULLS LAST
        LIMIT ${limit} OFFSET ${offset}
      `),
    ])

    const total = Number(countResult[0]?.total ?? 0)

    const customers = dataResult.map((r) => ({
      customer_id: r.customer_id,
      customer_type: r.customer_type,
      first_name: r.first_name,
      last_name: r.last_name,
      business_name: r.business_name ?? null,
      segment_name: r.segment_name ?? null,
      churn_risk: r.churn_risk ?? null,
      total_spend: Number(r.total_spend),
      transaction_count: Number(r.transaction_count),
      last_transaction_date: r.last_transaction_date
        ? new Date(r.last_transaction_date as string).toISOString()
        : null,
    }))

    return NextResponse.json({ customers, total })
  } catch (error) {
    console.error('Failed to fetch customers:', error)
    return NextResponse.json({ error: 'Failed to fetch customers' }, { status: 500 })
  }
})
