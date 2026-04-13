import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth-middleware'
import { db } from '@/db'
import { sql } from 'drizzle-orm'
import { cachedJson, getFromCache, setInCache } from '@/lib/cache'

export const GET = withAuth(async (_request: NextRequest) => {
  const cacheKey = 'kpi-aging'
  const cached = getFromCache(cacheKey)
  if (cached) return cachedJson(cached, 60, 120)

  try {
    const result = await db.execute(sql`
      SELECT
        CASE
          WHEN due_date >= CURRENT_DATE THEN 'Current'
          WHEN due_date >= CURRENT_DATE - INTERVAL '30 days' THEN '1-30 days'
          WHEN due_date >= CURRENT_DATE - INTERVAL '60 days' THEN '31-60 days'
          WHEN due_date >= CURRENT_DATE - INTERVAL '90 days' THEN '61-90 days'
          ELSE '90+ days'
        END AS bucket,
        COALESCE(SUM(balance_remaining::numeric), 0) AS amount
      FROM invoices_col
      WHERE status != 'PAID'
      GROUP BY 1
    `)

    // Ensure all buckets are present in correct order
    const bucketOrder = ['Current', '1-30 days', '31-60 days', '61-90 days', '90+ days']
    const bucketMap = new Map<string, number>()

    for (const row of result) {
      bucketMap.set(String(row.bucket), Number(row.amount))
    }

    const aging = bucketOrder.map((bucket) => ({
      bucket,
      amount: bucketMap.get(bucket) ?? 0,
    }))

    setInCache(cacheKey, aging, 60_000)
    return cachedJson(aging, 60, 120)
  } catch (error) {
    console.error('Failed to fetch aging data:', error)
    return NextResponse.json({ error: 'Failed to fetch aging data' }, { status: 500 })
  }
})
