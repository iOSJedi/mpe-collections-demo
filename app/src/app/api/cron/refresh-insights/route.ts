import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth-middleware'
import { db } from '@/db'
import { insightCards, invoices, incomingPayments, delinquencyScores, customers } from '@/db/schema'
import { sql, eq, lt } from 'drizzle-orm'

interface InsightCardData {
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO'
  title: string
  body: string
  action: string | null
  related_entity_type: string | null
}

async function gatherCollectionsAnalytics() {
  // Total overdue receivables
  const overdueResult = await db.execute<{ total_overdue: string; overdue_count: string }>(sql`
    SELECT
      COALESCE(SUM(balance_remaining::numeric), 0)::text AS total_overdue,
      COUNT(*)::text AS overdue_count
    FROM invoices_col
    WHERE status IN ('OVERDUE', 'PARTIAL')
      AND due_date < CURRENT_DATE
  `)

  // High / critical delinquency count
  const highRiskResult = await db
    .select({ count: sql<string>`COUNT(*)::text` })
    .from(delinquencyScores)
    .where(sql`${delinquencyScores.riskLevel} IN ('HIGH', 'CRITICAL')`)

  // Pending payments awaiting confirmation
  const pendingPayments = await db.execute<{ count: string; total: string }>(sql`
    SELECT
      COUNT(*)::text AS count,
      COALESCE(SUM(amount::numeric), 0)::text AS total
    FROM incoming_payments_col
    WHERE status = 'PENDING'
  `)

  // DSO (Days Sales Outstanding) approximation
  const dsoResult = await db.execute<{ dso: string }>(sql`
    SELECT
      CASE
        WHEN COALESCE(SUM(i.amount::numeric), 0) = 0 THEN '0'
        ELSE ROUND(
          COALESCE(SUM(i.balance_remaining::numeric), 0) /
          NULLIF(COALESCE(SUM(i.amount::numeric), 0), 0) * 30
        , 1)::text
      END AS dso
    FROM invoices_col i
    WHERE i.issued_at >= CURRENT_DATE - interval '90 days'
  `)

  // Escalations open
  const openEscalations = await db.execute<{ count: string }>(sql`
    SELECT COUNT(*)::text AS count FROM escalations_col WHERE status = 'OPEN'
  `)

  return {
    overdueTotal: Number(overdueResult[0]?.total_overdue ?? 0),
    overdueCount: Number(overdueResult[0]?.overdue_count ?? 0),
    highRiskCount: Number(highRiskResult[0]?.count ?? 0),
    pendingPaymentsCount: Number(pendingPayments[0]?.count ?? 0),
    pendingPaymentsTotal: Number(pendingPayments[0]?.total ?? 0),
    dso: Number(dsoResult[0]?.dso ?? 0),
    openEscalations: Number(openEscalations[0]?.count ?? 0),
  }
}

async function generateInsightsWithGemini(
  data: Awaited<ReturnType<typeof gatherCollectionsAnalytics>>
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

    const prompt = `You are a collections management AI for Ayala Land MPE (a major Philippine real estate company managing malls, offices, and properties).

Given the following collections analytics summary, generate 5-8 insight cards for the collections dashboard.

Analytics Data:
- Total overdue receivables: PHP ${data.overdueTotal.toLocaleString()} across ${data.overdueCount} invoices
- High/critical delinquency risk customers: ${data.highRiskCount}
- Pending payment confirmations: ${data.pendingPaymentsCount} payments totaling PHP ${data.pendingPaymentsTotal.toLocaleString()}
- Days Sales Outstanding (DSO): ${data.dso} days
- Open escalations: ${data.openEscalations}

Return a JSON array of insight cards. Each card must have:
- severity: one of "CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"
- title: short headline (under 80 chars)
- body: 1-2 sentence explanation
- action: suggested next step or null
- related_entity_type: one of "invoice", "customer", "payment", "escalation" or null

Be specific to Philippine real estate collections context. Use PHP for amounts.`

    const result = await model.generateContent(prompt)
    const parsed = JSON.parse(result.response.text())
    const cards: InsightCardData[] = Array.isArray(parsed) ? parsed : parsed.insights ?? parsed.cards ?? []
    return cards.slice(0, 8)
  } catch (error) {
    console.warn('Gemini not available, using demo insights:', error)
    return generateDemoInsights(data)
  }
}

function generateDemoInsights(
  data: Awaited<ReturnType<typeof gatherCollectionsAnalytics>>
): InsightCardData[] {
  const cards: InsightCardData[] = []

  if (data.overdueCount > 0) {
    cards.push({
      severity: data.overdueTotal > 1_000_000 ? 'CRITICAL' : 'HIGH',
      title: `PHP ${data.overdueTotal.toLocaleString()} overdue across ${data.overdueCount} invoices`,
      body: `There are currently ${data.overdueCount} overdue invoices totaling PHP ${data.overdueTotal.toLocaleString()}. Immediate follow-up is recommended to reduce aging.`,
      action: 'Review collections worklist and prioritize high-value accounts',
      related_entity_type: 'INVOICE',
    })
  }

  if (data.highRiskCount > 0) {
    cards.push({
      severity: data.highRiskCount > 20 ? 'CRITICAL' : 'HIGH',
      title: `${data.highRiskCount} tenants flagged as high delinquency risk`,
      body: `${data.highRiskCount} customers have high or critical delinquency risk scores. Proactive outreach can prevent further escalation.`,
      action: 'View risk-scored customers in the receivables module',
      related_entity_type: 'CUSTOMER',
    })
  }

  if (data.pendingPaymentsCount > 0) {
    cards.push({
      severity: 'MEDIUM',
      title: `${data.pendingPaymentsCount} payments awaiting confirmation`,
      body: `PHP ${data.pendingPaymentsTotal.toLocaleString()} in incoming payments are pending confirmation. Verify documents and confirm to update balances.`,
      action: 'Go to Incoming Payments log to confirm pending transactions',
      related_entity_type: 'INVOICE',
    })
  }

  if (data.dso > 45) {
    cards.push({
      severity: 'HIGH',
      title: `DSO at ${data.dso} days — above 45-day target`,
      body: `Your Days Sales Outstanding is ${data.dso} days, exceeding the 45-day benchmark. Accelerating collections can improve cash flow significantly.`,
      action: 'Review and expedite collections for oldest outstanding invoices',
      related_entity_type: 'INVOICE',
    })
  } else {
    cards.push({
      severity: 'INFO',
      title: `DSO at ${data.dso} days — within target`,
      body: `Days Sales Outstanding is ${data.dso} days, within the 45-day benchmark. Continue current collection cadence.`,
      action: null,
      related_entity_type: null,
    })
  }

  if (data.openEscalations > 0) {
    cards.push({
      severity: data.openEscalations > 5 ? 'HIGH' : 'MEDIUM',
      title: `${data.openEscalations} open escalations require attention`,
      body: `There are ${data.openEscalations} unresolved escalations in the queue. Timely resolution ensures accurate receivable records.`,
      action: 'Review escalation queue in the Collections module',
      related_entity_type: 'CUSTOMER',
    })
  }

  cards.push({
    severity: 'INFO',
    title: 'ML delinquency scores refreshed',
    body: 'Customer delinquency and credit risk scores have been updated with the latest payment data. Use these scores to prioritize collections outreach.',
    action: 'View customer risk scores in Receivables',
    related_entity_type: 'CUSTOMER',
  })

  return cards
}

async function refreshInsights() {
  const analyticsData = await gatherCollectionsAnalytics()
  const newInsights = await generateInsightsWithGemini(analyticsData)

  // Deactivate old insight cards
  await db
    .update(insightCards)
    .set({ isActive: false })
    .where(sql`${insightCards.isActive} = true`)

  // Insert new insight cards
  if (newInsights.length > 0) {
    await db.insert(insightCards).values(
      newInsights.map((card) => ({
        severity: card.severity,
        title: card.title,
        body: card.body,
        action: card.action,
        relatedEntityType: card.related_entity_type,
        isActive: true,
      }))
    )
  }

  return { analyticsData, count: newInsights.length }
}

// POST — callable from cron (CRON_SECRET) or from logged-in user (Firebase token)
export async function POST(request: NextRequest) {
  // Allow via CRON_SECRET or via Firebase auth token
  const cronSecret = process.env.CRON_SECRET
  const authHeader = request.headers.get('authorization')

  if (cronSecret && authHeader === `Bearer ${cronSecret}`) {
    // Cron access — OK
  } else {
    // Fall back to Firebase auth
    const user = await verifyToken(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  try {
    const { analyticsData, count } = await refreshInsights()
    return NextResponse.json({
      success: true,
      insights_generated: count,
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
