import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth-middleware'
import { db } from '@/db'
import { sql } from 'drizzle-orm'

export const GET = withAuth(async (_request: NextRequest) => {
  try {
    // Determine "current month" from the data itself (synthetic data may not match real date)
    const dateResult = await db.execute(sql`
      SELECT
        date_trunc('month', MAX(transaction_date)) AS current_month,
        date_trunc('month', MAX(transaction_date)) - interval '1 month' AS last_month
      FROM transactions
    `)

    if (!dateResult.length || !dateResult[0].current_month) {
      return NextResponse.json({
        revenue: { this_month: 0, last_month: 0, change_pct: 0 },
        active_customers: { total: 0, retail: 0, wholesale: 0 },
        wholesale_credit: { outstanding: 0, overdue_pct: 0 },
        top_branch: { branch_id: null, branch_name: null, revenue: 0 },
      })
    }

    const currentMonth = dateResult[0].current_month
    const lastMonth = dateResult[0].last_month

    // Run all KPI queries in parallel
    const [revenueResult, customersResult, creditResult, topBranchResult] = await Promise.all([
      // 1. Revenue this month vs last month
      db.execute(sql`
        SELECT
          COALESCE(SUM(CASE WHEN date_trunc('month', transaction_date) = ${currentMonth}
            THEN total_amount::numeric ELSE 0 END), 0) AS this_month,
          COALESCE(SUM(CASE WHEN date_trunc('month', transaction_date) = ${lastMonth}
            THEN total_amount::numeric ELSE 0 END), 0) AS last_month
        FROM transactions
        WHERE date_trunc('month', transaction_date) IN (${currentMonth}, ${lastMonth})
      `),

      // 2. Active customers this month by type
      db.execute(sql`
        SELECT
          COUNT(DISTINCT t.customer_id) AS total,
          COUNT(DISTINCT CASE WHEN c.customer_type = 'retail' THEN t.customer_id END) AS retail,
          COUNT(DISTINCT CASE WHEN c.customer_type IN ('wholesale', 'both') THEN t.customer_id END) AS wholesale
        FROM transactions t
        JOIN customers c ON c.customer_id = t.customer_id
        WHERE date_trunc('month', t.transaction_date) = ${currentMonth}
      `),

      // 3. Wholesale credit outstanding
      db.execute(sql`
        SELECT
          COALESCE(SUM(outstanding_balance::numeric), 0) AS total_outstanding,
          CASE
            WHEN COUNT(*) = 0 THEN 0
            ELSE ROUND(
              COUNT(CASE WHEN days_overdue > 0 THEN 1 END)::numeric / COUNT(*)::numeric * 100, 1
            )
          END AS overdue_pct
        FROM (
          SELECT DISTINCT ON (customer_id)
            customer_id, outstanding_balance, days_overdue
          FROM wholesale_payments
          ORDER BY customer_id, payment_date DESC
        ) latest
      `),

      // 4. Top branch by revenue this month
      db.execute(sql`
        SELECT
          t.branch_id,
          b.branch_name,
          COALESCE(SUM(t.total_amount::numeric), 0) AS revenue
        FROM transactions t
        JOIN branches b ON b.branch_id = t.branch_id
        WHERE date_trunc('month', t.transaction_date) = ${currentMonth}
        GROUP BY t.branch_id, b.branch_name
        ORDER BY revenue DESC
        LIMIT 1
      `),
    ])

    const thisMonth = Number(revenueResult[0]?.this_month ?? 0)
    const lastMonthRev = Number(revenueResult[0]?.last_month ?? 0)
    const changePct = lastMonthRev === 0 ? 0 : Math.round(((thisMonth - lastMonthRev) / lastMonthRev) * 1000) / 10

    return NextResponse.json({
      revenue: {
        this_month: thisMonth,
        last_month: lastMonthRev,
        change_pct: changePct,
      },
      active_customers: {
        total: Number(customersResult[0]?.total ?? 0),
        retail: Number(customersResult[0]?.retail ?? 0),
        wholesale: Number(customersResult[0]?.wholesale ?? 0),
      },
      wholesale_credit: {
        outstanding: Number(creditResult[0]?.total_outstanding ?? 0),
        overdue_pct: Number(creditResult[0]?.overdue_pct ?? 0),
      },
      top_branch: {
        branch_id: topBranchResult[0]?.branch_id ?? null,
        branch_name: topBranchResult[0]?.branch_name ?? null,
        revenue: Number(topBranchResult[0]?.revenue ?? 0),
      },
    })
  } catch (error) {
    console.error('Failed to fetch KPIs:', error)
    return NextResponse.json({ error: 'Failed to fetch KPIs' }, { status: 500 })
  }
})
