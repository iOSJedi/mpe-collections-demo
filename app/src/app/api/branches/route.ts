import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth-middleware'
import { db } from '@/db'
import { sql } from 'drizzle-orm'

export const GET = withAuth(async (_request: NextRequest) => {
  try {
    // Determine "current month" from the data itself
    const dateResult = await db.execute(sql`
      SELECT
        date_trunc('month', MAX(transaction_date)) AS current_month,
        date_trunc('month', MAX(transaction_date)) - interval '1 month' AS last_month
      FROM transactions
    `)

    if (!dateResult.length || !dateResult[0].current_month) {
      return NextResponse.json({ branches: [] })
    }

    const currentMonth = dateResult[0].current_month
    const lastMonth = dateResult[0].last_month

    // Run branch summary and top categories in parallel
    const [branchResult, categoriesResult] = await Promise.all([
      // Branch-level aggregations
      db.execute(sql`
        SELECT
          b.branch_id,
          b.branch_name,
          b.municipality,
          b.province,
          COALESCE(SUM(CASE
            WHEN date_trunc('month', t.transaction_date) = ${currentMonth}
            THEN t.total_amount::numeric ELSE 0 END
          ), 0) AS revenue_this_month,
          COALESCE(SUM(CASE
            WHEN date_trunc('month', t.transaction_date) = ${lastMonth}
            THEN t.total_amount::numeric ELSE 0 END
          ), 0) AS revenue_last_month,
          COUNT(CASE
            WHEN date_trunc('month', t.transaction_date) = ${currentMonth}
            THEN 1 END
          )::int AS transaction_count,
          CASE
            WHEN COUNT(CASE
              WHEN date_trunc('month', t.transaction_date) = ${currentMonth}
              THEN 1 END
            ) = 0 THEN 0
            ELSE ROUND(
              SUM(CASE
                WHEN date_trunc('month', t.transaction_date) = ${currentMonth}
                THEN t.total_amount::numeric ELSE 0 END
              ) / COUNT(CASE
                WHEN date_trunc('month', t.transaction_date) = ${currentMonth}
                THEN 1 END
              )::numeric, 2
            )
          END AS avg_basket_size,
          COALESCE(SUM(CASE
            WHEN date_trunc('month', t.transaction_date) = ${currentMonth}
              AND t.transaction_type = 'retail'
            THEN t.total_amount::numeric ELSE 0 END
          ), 0) AS retail_revenue,
          COALESCE(SUM(CASE
            WHEN date_trunc('month', t.transaction_date) = ${currentMonth}
              AND t.transaction_type = 'wholesale'
            THEN t.total_amount::numeric ELSE 0 END
          ), 0) AS wholesale_revenue
        FROM branches b
        LEFT JOIN transactions t ON t.branch_id = b.branch_id
          AND date_trunc('month', t.transaction_date) IN (${currentMonth}, ${lastMonth})
        WHERE b.is_active = true
        GROUP BY b.branch_id, b.branch_name, b.municipality, b.province
        ORDER BY revenue_this_month DESC
      `),

      // Top 5 categories per branch for current month
      db.execute(sql`
        WITH ranked AS (
          SELECT
            t.branch_id,
            p.category,
            SUM(ti.line_total::numeric) AS total,
            ROW_NUMBER() OVER (PARTITION BY t.branch_id ORDER BY SUM(ti.line_total::numeric) DESC) AS rn
          FROM transactions t
          JOIN transaction_items ti ON ti.transaction_id = t.transaction_id
          JOIN products p ON p.product_id = ti.product_id
          WHERE date_trunc('month', t.transaction_date) = ${currentMonth}
          GROUP BY t.branch_id, p.category
        )
        SELECT branch_id, category, total
        FROM ranked
        WHERE rn <= 5
        ORDER BY branch_id, total DESC
      `),
    ])

    // Build a map of branch_id -> top categories
    const categoryMap: Record<string, { category: string; total: number }[]> = {}
    for (const row of categoriesResult) {
      const bid = row.branch_id as string
      if (!categoryMap[bid]) categoryMap[bid] = []
      categoryMap[bid].push({
        category: row.category as string,
        total: Number(row.total),
      })
    }

    const branches = branchResult.map((r) => {
      const thisMonth = Number(r.revenue_this_month)
      const lastMonthRev = Number(r.revenue_last_month)
      const changePct =
        lastMonthRev === 0
          ? 0
          : Math.round(((thisMonth - lastMonthRev) / lastMonthRev) * 1000) / 10

      return {
        branch_id: r.branch_id as string,
        branch_name: r.branch_name as string,
        municipality: r.municipality as string,
        province: r.province as string,
        revenue_this_month: thisMonth,
        revenue_last_month: lastMonthRev,
        revenue_change: changePct,
        transaction_count: Number(r.transaction_count),
        avg_basket_size: Number(r.avg_basket_size),
        retail_revenue: Number(r.retail_revenue),
        wholesale_revenue: Number(r.wholesale_revenue),
        top_categories: categoryMap[r.branch_id as string] ?? [],
      }
    })

    return NextResponse.json({ branches })
  } catch (error) {
    console.error('Failed to fetch branch data:', error)
    return NextResponse.json({ error: 'Failed to fetch branch data' }, { status: 500 })
  }
})
