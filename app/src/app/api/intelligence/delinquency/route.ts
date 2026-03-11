import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth-middleware'
import { db } from '@/db'
import { delinquencyScores, customers } from '@/db/schema'
import { eq, desc } from 'drizzle-orm'

export const GET = withAuth(async (_request: NextRequest) => {
  try {
    const rows = await db
      .select({
        customer_id: customers.customerId,
        name: customers.name,
        property_name: customers.propertyName,
        risk_score: delinquencyScores.riskScore,
        risk_level: delinquencyScores.riskLevel,
        top_risk_factor: delinquencyScores.topRiskFactor,
        days_overdue_avg: delinquencyScores.daysOverdueAvg,
        missed_payments: delinquencyScores.missedPayments,
      })
      .from(delinquencyScores)
      .innerJoin(customers, eq(customers.customerId, delinquencyScores.customerId))
      .orderBy(desc(delinquencyScores.riskScore))
      .limit(50)

    const result = rows.map((r) => ({
      customer_id: r.customer_id,
      name: r.name,
      property_name: r.property_name,
      risk_score: Number(r.risk_score),
      risk_level: r.risk_level,
      top_risk_factor: r.top_risk_factor,
      days_overdue_avg: r.days_overdue_avg ? Number(r.days_overdue_avg) : null,
      missed_payments: r.missed_payments,
    }))

    return NextResponse.json({ rows: result })
  } catch (error) {
    console.error('Failed to fetch delinquency scores:', error)
    return NextResponse.json({ error: 'Failed to fetch delinquency scores' }, { status: 500 })
  }
})
