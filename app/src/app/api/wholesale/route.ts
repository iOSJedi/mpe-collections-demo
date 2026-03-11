import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth-middleware'
import { db } from '@/db'
import { sql } from 'drizzle-orm'

export const GET = withAuth(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url)
    const branch = searchParams.get('branch') || 'all'
    const riskLevel = searchParams.get('riskLevel') || 'all'
    const sortBy = searchParams.get('sortBy') || 'risk_score'

    const branchCondition =
      branch && branch !== 'all'
        ? sql`AND t.branch_id = ${branch}`
        : sql``

    const riskCondition =
      riskLevel && riskLevel !== 'all'
        ? sql`AND cr.risk_level = ${riskLevel}`
        : sql``

    // Validate sort column to prevent injection
    const sortColumn = ['risk_score', 'total_spend', 'days_overdue', 'last_order'].includes(sortBy)
      ? sortBy
      : 'risk_score'

    const sortExpression =
      sortColumn === 'risk_score'
        ? sql`cr.risk_score DESC NULLS LAST`
        : sortColumn === 'total_spend'
          ? sql`recent.total_spend DESC NULLS LAST`
          : sortColumn === 'days_overdue'
            ? sql`cr.avg_days_overdue DESC NULLS LAST`
            : sql`recent.last_order_date DESC NULLS LAST`

    // Main buyer query
    const buyersResult = await db.execute(sql`
      WITH recent_txns AS (
        SELECT
          t.customer_id,
          SUM(t.total_amount::numeric) AS total_spend,
          MAX(t.transaction_date) AS last_order_date,
          COUNT(*) AS order_count
        FROM transactions t
        WHERE t.transaction_type = 'wholesale'
        ${branchCondition}
        GROUP BY t.customer_id
      ),
      buyer_branches AS (
        SELECT DISTINCT ON (t.customer_id)
          t.customer_id,
          b.branch_name
        FROM transactions t
        JOIN branches b ON b.branch_id = t.branch_id
        WHERE t.transaction_type = 'wholesale'
        ORDER BY t.customer_id, t.transaction_date DESC
      )
      SELECT
        c.customer_id,
        c.first_name,
        c.last_name,
        c.business_name,
        COALESCE(bb.branch_name, 'N/A') AS branch_name,
        COALESCE(cr.risk_score::numeric, 0) AS risk_score,
        COALESCE(cr.risk_level, 'unknown') AS risk_level,
        COALESCE(cr.outstanding_balance::numeric, 0) AS outstanding_balance,
        COALESCE(c.credit_limit::numeric, 0) AS credit_limit,
        COALESCE(cr.credit_utilization::numeric, 0) AS credit_utilization,
        COALESCE(cr.avg_days_overdue::numeric, 0) AS avg_days_overdue,
        COALESCE(cr.payment_trend, 'stable') AS payment_trend,
        cr.top_risk_factor,
        COALESCE(recent.total_spend, 0) AS total_spend,
        recent.last_order_date,
        COALESCE(ch.frequency_change::numeric, 0) AS order_frequency_trend,
        COALESCE(ch.basket_change::numeric, 0) AS basket_size_trend
      FROM customers c
      JOIN recent_txns recent ON recent.customer_id = c.customer_id
      LEFT JOIN credit_risk_scores cr ON cr.customer_id = c.customer_id
      LEFT JOIN churn_scores ch ON ch.customer_id = c.customer_id
      LEFT JOIN buyer_branches bb ON bb.customer_id = c.customer_id
      WHERE c.customer_type IN ('wholesale', 'both')
      ${riskCondition}
      ORDER BY ${sortExpression}
    `)

    // Get monthly totals for each buyer (last 6 months)
    const buyerIds = buyersResult.map((r) => r.customer_id as string)

    let monthlyMap: Record<string, { month: string; total: number }[]> = {}

    if (buyerIds.length > 0) {
      const monthlyResult = await db.execute(sql`
        WITH max_date AS (
          SELECT date_trunc('month', MAX(transaction_date)) AS latest
          FROM transactions
          WHERE transaction_type = 'wholesale'
        )
        SELECT
          t.customer_id,
          to_char(date_trunc('month', t.transaction_date), 'YYYY-MM') AS month,
          SUM(t.total_amount::numeric) AS total
        FROM transactions t, max_date m
        WHERE t.transaction_type = 'wholesale'
          AND t.customer_id = ANY(${buyerIds})
          AND date_trunc('month', t.transaction_date) > m.latest - interval '6 months'
        GROUP BY t.customer_id, date_trunc('month', t.transaction_date)
        ORDER BY t.customer_id, month
      `)

      monthlyMap = {}
      for (const row of monthlyResult) {
        const cid = row.customer_id as string
        if (!monthlyMap[cid]) monthlyMap[cid] = []
        monthlyMap[cid].push({
          month: row.month as string,
          total: Number(row.total),
        })
      }
    }

    const buyers = buyersResult.map((r) => ({
      customer_id: r.customer_id as string,
      first_name: r.first_name as string,
      last_name: r.last_name as string,
      business_name: (r.business_name as string) ?? '',
      branch_name: r.branch_name as string,
      risk_score: Number(r.risk_score),
      risk_level: r.risk_level as string,
      outstanding_balance: Number(r.outstanding_balance),
      credit_limit: Number(r.credit_limit),
      credit_utilization: Number(r.credit_utilization),
      avg_days_overdue: Number(r.avg_days_overdue),
      payment_trend: r.payment_trend as string,
      order_frequency_trend: Number(r.order_frequency_trend),
      basket_size_trend: Number(r.basket_size_trend),
      last_order_date: r.last_order_date
        ? new Date(r.last_order_date as string).toISOString()
        : null,
      top_risk_factor: (r.top_risk_factor as string) ?? null,
      monthly_totals: monthlyMap[r.customer_id as string] ?? [],
    }))

    return NextResponse.json({ buyers })
  } catch (error) {
    console.error('Failed to fetch wholesale buyers:', error)
    return NextResponse.json({ error: 'Failed to fetch wholesale buyers' }, { status: 500 })
  }
})
