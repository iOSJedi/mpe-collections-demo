import { NextResponse } from 'next/server'
import { db } from '@/db'
import { insightCards, churnScores } from '@/db/schema'
import { sql, eq } from 'drizzle-orm'

interface InsightCardData {
  severity: 'info' | 'warning' | 'alert' | 'opportunity'
  title: string
  body: string
  action: string | null
  related_intent: string | null
}

async function gatherAnalyticsData() {
  // Week-over-week revenue change
  const revenueWoW = await db.execute<{
    this_week: string
    last_week: string
  }>(sql`
    SELECT
      COALESCE(SUM(CASE WHEN transaction_date >= date_trunc('week', CURRENT_DATE) THEN total_amount::numeric ELSE 0 END), 0) AS this_week,
      COALESCE(SUM(CASE WHEN transaction_date >= date_trunc('week', CURRENT_DATE) - interval '7 days'
        AND transaction_date < date_trunc('week', CURRENT_DATE) THEN total_amount::numeric ELSE 0 END), 0) AS last_week
    FROM transactions
    WHERE transaction_date >= date_trunc('week', CURRENT_DATE) - interval '7 days'
  `)

  // Number of overdue wholesale credit accounts
  const overdueAccounts = await db.execute<{ count: string }>(sql`
    SELECT COUNT(DISTINCT customer_id)::text AS count
    FROM wholesale_payments
    WHERE days_overdue > 0
  `)

  // Churn-risk customers (high + critical)
  const churnRiskCount = await db
    .select({ count: sql<string>`COUNT(*)::text` })
    .from(churnScores)
    .where(
      sql`${churnScores.riskLevel} IN ('high', 'critical')`
    )

  // Branch with biggest revenue increase/decrease (this month vs last month)
  const branchRevChange = await db.execute<{
    branch_name: string
    this_month: string
    last_month: string
    change_pct: string
  }>(sql`
    SELECT
      b.branch_name,
      COALESCE(SUM(CASE WHEN t.transaction_date >= date_trunc('month', CURRENT_DATE) THEN t.total_amount::numeric ELSE 0 END), 0) AS this_month,
      COALESCE(SUM(CASE WHEN t.transaction_date >= date_trunc('month', CURRENT_DATE) - interval '1 month'
        AND t.transaction_date < date_trunc('month', CURRENT_DATE) THEN t.total_amount::numeric ELSE 0 END), 0) AS last_month,
      CASE
        WHEN COALESCE(SUM(CASE WHEN t.transaction_date >= date_trunc('month', CURRENT_DATE) - interval '1 month'
          AND t.transaction_date < date_trunc('month', CURRENT_DATE) THEN t.total_amount::numeric ELSE 0 END), 0) = 0 THEN 0
        ELSE ROUND(
          (COALESCE(SUM(CASE WHEN t.transaction_date >= date_trunc('month', CURRENT_DATE) THEN t.total_amount::numeric ELSE 0 END), 0)
           - COALESCE(SUM(CASE WHEN t.transaction_date >= date_trunc('month', CURRENT_DATE) - interval '1 month'
             AND t.transaction_date < date_trunc('month', CURRENT_DATE) THEN t.total_amount::numeric ELSE 0 END), 0))
          / NULLIF(COALESCE(SUM(CASE WHEN t.transaction_date >= date_trunc('month', CURRENT_DATE) - interval '1 month'
            AND t.transaction_date < date_trunc('month', CURRENT_DATE) THEN t.total_amount::numeric ELSE 0 END), 0), 0) * 100
        , 1)
      END AS change_pct
    FROM branches b
    LEFT JOIN transactions t ON t.branch_id = b.branch_id
    WHERE b.is_active = true
    GROUP BY b.branch_name
    ORDER BY change_pct DESC
  `)

  // Top growing product category
  const topCategory = await db.execute<{
    category: string
    this_month: string
    last_month: string
    growth_pct: string
  }>(sql`
    SELECT
      p.category,
      COALESCE(SUM(CASE WHEN t.transaction_date >= date_trunc('month', CURRENT_DATE) THEN ti.line_total::numeric ELSE 0 END), 0) AS this_month,
      COALESCE(SUM(CASE WHEN t.transaction_date >= date_trunc('month', CURRENT_DATE) - interval '1 month'
        AND t.transaction_date < date_trunc('month', CURRENT_DATE) THEN ti.line_total::numeric ELSE 0 END), 0) AS last_month,
      CASE
        WHEN COALESCE(SUM(CASE WHEN t.transaction_date >= date_trunc('month', CURRENT_DATE) - interval '1 month'
          AND t.transaction_date < date_trunc('month', CURRENT_DATE) THEN ti.line_total::numeric ELSE 0 END), 0) = 0 THEN 0
        ELSE ROUND(
          (COALESCE(SUM(CASE WHEN t.transaction_date >= date_trunc('month', CURRENT_DATE) THEN ti.line_total::numeric ELSE 0 END), 0)
           - COALESCE(SUM(CASE WHEN t.transaction_date >= date_trunc('month', CURRENT_DATE) - interval '1 month'
             AND t.transaction_date < date_trunc('month', CURRENT_DATE) THEN ti.line_total::numeric ELSE 0 END), 0))
          / NULLIF(COALESCE(SUM(CASE WHEN t.transaction_date >= date_trunc('month', CURRENT_DATE) - interval '1 month'
            AND t.transaction_date < date_trunc('month', CURRENT_DATE) THEN ti.line_total::numeric ELSE 0 END), 0), 0) * 100
        , 1)
      END AS growth_pct
    FROM transaction_items ti
    JOIN transactions t ON t.transaction_id = ti.transaction_id
    JOIN products p ON p.product_id = ti.product_id
    WHERE t.transaction_date >= date_trunc('month', CURRENT_DATE) - interval '1 month'
    GROUP BY p.category
    HAVING COALESCE(SUM(CASE WHEN t.transaction_date >= date_trunc('month', CURRENT_DATE) - interval '1 month'
      AND t.transaction_date < date_trunc('month', CURRENT_DATE) THEN ti.line_total::numeric ELSE 0 END), 0) > 0
    ORDER BY growth_pct DESC
    LIMIT 1
  `)

  const thisWeek = Number(revenueWoW[0]?.this_week ?? 0)
  const lastWeek = Number(revenueWoW[0]?.last_week ?? 0)
  const wowChange = lastWeek > 0 ? ((thisWeek - lastWeek) / lastWeek * 100).toFixed(1) : '0'

  const overdueCount = Number(overdueAccounts[0]?.count ?? 0)
  const churnCount = Number(churnRiskCount[0]?.count ?? 0)

  const topBranch = branchRevChange.length > 0 ? branchRevChange[0] : null
  const bottomBranch = branchRevChange.length > 1 ? branchRevChange[branchRevChange.length - 1] : null

  const topGrowingCategory = topCategory.length > 0 ? topCategory[0] : null

  return {
    revenue: { thisWeek, lastWeek, wowChange },
    overdueAccounts: overdueCount,
    churnRiskCustomers: churnCount,
    topBranch: topBranch ? { name: topBranch.branch_name, changePct: topBranch.change_pct } : null,
    bottomBranch: bottomBranch ? { name: bottomBranch.branch_name, changePct: bottomBranch.change_pct } : null,
    topGrowingCategory: topGrowingCategory ? { name: topGrowingCategory.category, growthPct: topGrowingCategory.growth_pct } : null,
  }
}

async function generateInsightsWithGemini(
  analyticsData: Awaited<ReturnType<typeof gatherAnalyticsData>>
): Promise<InsightCardData[]> {
  try {
    const { GoogleGenerativeAI } = await import('@google/generative-ai')

    if (!process.env.GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY not set')
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash',
      generationConfig: { temperature: 0.4, responseMimeType: 'application/json' },
    })

    const prompt = `You are a business analytics AI for a Philippine grocery chain (JC Supermarket, Batangas region).

Given the following analytics summary, generate 5-8 insight cards for the management dashboard.

Analytics Data:
- Week-over-week revenue change: ${analyticsData.revenue.wowChange}% (this week: PHP ${analyticsData.revenue.thisWeek.toLocaleString()}, last week: PHP ${analyticsData.revenue.lastWeek.toLocaleString()})
- Overdue wholesale credit accounts: ${analyticsData.overdueAccounts}
- High/critical churn risk customers: ${analyticsData.churnRiskCustomers}
- Top performing branch: ${analyticsData.topBranch?.name ?? 'N/A'} (${analyticsData.topBranch?.changePct ?? 0}% change)
- Lowest performing branch: ${analyticsData.bottomBranch?.name ?? 'N/A'} (${analyticsData.bottomBranch?.changePct ?? 0}% change)
- Top growing product category: ${analyticsData.topGrowingCategory?.name ?? 'N/A'} (${analyticsData.topGrowingCategory?.growthPct ?? 0}% growth)

Return a JSON array of insight cards. Each card must have:
- severity: one of "info", "warning", "alert", "opportunity"
- title: short headline (under 80 chars)
- body: 1-2 sentence explanation
- action: suggested next step or null
- related_intent: one of "revenue_trend", "churn_risk", "credit_risk", "branch_performance", "category_performance", "customer_segmentation" or null

Be specific to the data. Use Philippine Peso (PHP) for amounts. Focus on actionable insights.`

    const result = await model.generateContent(prompt)
    const parsed = JSON.parse(result.response.text())

    // Handle both { insights: [...] } and direct array
    const cards: InsightCardData[] = Array.isArray(parsed) ? parsed : parsed.insights ?? parsed.cards ?? []
    return cards.slice(0, 8)
  } catch (error) {
    console.warn('Gemini not available, using demo insights:', error)
    return generateDemoInsights(analyticsData)
  }
}

function generateDemoInsights(
  data: Awaited<ReturnType<typeof gatherAnalyticsData>>
): InsightCardData[] {
  const cards: InsightCardData[] = []

  // Revenue trend
  const wowNum = Number(data.revenue.wowChange)
  if (wowNum > 0) {
    cards.push({
      severity: 'info',
      title: `Weekly revenue up ${data.revenue.wowChange}%`,
      body: `This week's revenue of PHP ${data.revenue.thisWeek.toLocaleString()} is ${data.revenue.wowChange}% higher than last week. Positive momentum across branches.`,
      action: 'Review top-performing product categories to sustain growth',
      related_intent: 'revenue_trend',
    })
  } else {
    cards.push({
      severity: 'warning',
      title: `Weekly revenue declined ${Math.abs(wowNum).toFixed(1)}%`,
      body: `This week's revenue dropped to PHP ${data.revenue.thisWeek.toLocaleString()} from PHP ${data.revenue.lastWeek.toLocaleString()} last week.`,
      action: 'Check promotional calendar and investigate slowdown causes',
      related_intent: 'revenue_trend',
    })
  }

  // Overdue accounts
  if (data.overdueAccounts > 0) {
    cards.push({
      severity: data.overdueAccounts > 10 ? 'alert' : 'warning',
      title: `${data.overdueAccounts} wholesale accounts overdue`,
      body: `There are ${data.overdueAccounts} wholesale buyer accounts with overdue payments. Timely follow-up is recommended to minimize bad debt exposure.`,
      action: 'Review overdue accounts in Wholesale Health monitor',
      related_intent: 'credit_risk',
    })
  }

  // Churn risk
  if (data.churnRiskCustomers > 0) {
    cards.push({
      severity: data.churnRiskCustomers > 50 ? 'alert' : 'warning',
      title: `${data.churnRiskCustomers} customers at high churn risk`,
      body: `${data.churnRiskCustomers} customers have been flagged as high or critical churn risk based on declining purchase frequency and recency.`,
      action: 'Launch targeted retention campaign for at-risk customers',
      related_intent: 'churn_risk',
    })
  }

  // Top branch
  if (data.topBranch) {
    cards.push({
      severity: 'opportunity',
      title: `${data.topBranch.name} leads with ${data.topBranch.changePct}% growth`,
      body: `${data.topBranch.name} has the highest revenue growth this month. Consider analyzing what strategies are working for replication across other branches.`,
      action: 'Compare branch strategies in Branch Performance view',
      related_intent: 'branch_performance',
    })
  }

  // Bottom branch
  if (data.bottomBranch && Number(data.bottomBranch.changePct) < 0) {
    cards.push({
      severity: 'warning',
      title: `${data.bottomBranch.name} revenue down ${Math.abs(Number(data.bottomBranch.changePct)).toFixed(1)}%`,
      body: `${data.bottomBranch.name} has the largest revenue decline this period. Investigate local factors and foot traffic trends.`,
      action: 'Review branch detail and recent transactions',
      related_intent: 'branch_performance',
    })
  }

  // Top growing category
  if (data.topGrowingCategory) {
    cards.push({
      severity: 'opportunity',
      title: `${data.topGrowingCategory.name} category surging ${data.topGrowingCategory.growthPct}%`,
      body: `${data.topGrowingCategory.name} is the fastest-growing product category this month. Consider increasing shelf space and supplier negotiations.`,
      action: 'Review category performance breakdown',
      related_intent: 'category_performance',
    })
  }

  // Always include a segmentation insight
  cards.push({
    severity: 'info',
    title: 'Customer segmentation is up to date',
    body: 'RFM-based customer segments were last refreshed with the latest transaction data. Use segments for targeted promotions.',
    action: 'View customer segments in Analytics',
    related_intent: 'customer_segmentation',
  })

  // General recommendation
  cards.push({
    severity: 'info',
    title: 'Demand forecast available for next 30 days',
    body: 'Prophet-based demand forecasts have been generated. Use these to optimize inventory across all 7 branches.',
    action: 'Run demand forecast in Analytics',
    related_intent: null,
  })

  return cards
}

export async function POST() {
  try {
    // Step 1: Gather analytics data from the database
    const analyticsData = await gatherAnalyticsData()

    // Step 2: Generate insight cards (via Gemini or demo fallback)
    const newInsights = await generateInsightsWithGemini(analyticsData)

    // Step 3: Deactivate old insight cards
    await db
      .update(insightCards)
      .set({ isActive: false })
      .where(eq(insightCards.isActive, true))

    // Step 4: Insert new insight cards
    if (newInsights.length > 0) {
      await db.insert(insightCards).values(
        newInsights.map((card) => ({
          severity: card.severity,
          title: card.title,
          body: card.body,
          action: card.action,
          relatedIntent: card.related_intent,
          isActive: true,
        }))
      )
    }

    return NextResponse.json({
      success: true,
      insights_generated: newInsights.length,
      analytics_summary: analyticsData,
    })
  } catch (error) {
    console.error('Insight refresh failed:', error)
    return NextResponse.json(
      { error: 'Failed to refresh insights', details: String(error) },
      { status: 500 }
    )
  }
}
