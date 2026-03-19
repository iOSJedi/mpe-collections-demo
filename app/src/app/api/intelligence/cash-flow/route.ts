import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth-middleware'
import { db } from '@/db'
import { cashFlowForecasts } from '@/db/schema'
import { asc, sql } from 'drizzle-orm'

export const GET = withAuth(async (_request: NextRequest) => {
  try {
    // Fetch actual historical monthly cash flow (last 6 months)
    const actuals = await db.execute<{
      month: string
      actual_inflow: string
      actual_outflow: string
    }>(sql`
      WITH months AS (
        SELECT generate_series(
          date_trunc('month', CURRENT_DATE - interval '6 months'),
          date_trunc('month', CURRENT_DATE - interval '1 month'),
          '1 month'
        )::date AS month
      ),
      inflows AS (
        SELECT date_trunc('month', payment_date)::date AS month,
               COALESCE(SUM(amount::numeric), 0) AS total
        FROM incoming_payments_col
        WHERE status = 'CONFIRMED'
          AND payment_date >= CURRENT_DATE - interval '6 months'
        GROUP BY 1
      ),
      outflows AS (
        SELECT date_trunc('month', payment_date)::date AS month,
               COALESCE(SUM(amount::numeric), 0) AS total
        FROM outgoing_payments_col
        WHERE status IN ('COMPLETED','CONFIRMED')
          AND payment_date >= CURRENT_DATE - interval '6 months'
        GROUP BY 1
      )
      SELECT
        m.month::text,
        COALESCE(i.total, 0)::text AS actual_inflow,
        COALESCE(o.total, 0)::text AS actual_outflow
      FROM months m
      LEFT JOIN inflows  i ON i.month = m.month
      LEFT JOIN outflows o ON o.month = m.month
      ORDER BY m.month
    `)

    const actualPoints = actuals.map((r) => ({
      date: r.month.slice(0, 10),
      actual_inflow: Number(r.actual_inflow),
      actual_outflow: Number(r.actual_outflow),
    }))

    // Fetch forecast data
    const rows = await db
      .select()
      .from(cashFlowForecasts)
      .orderBy(asc(cashFlowForecasts.forecastDate))

    const forecastPoints = rows.map((r) => ({
      date: r.forecastDate,
      predicted_inflow: Number(r.predictedInflow),
      predicted_outflow: Number(r.predictedOutflow),
      confidence_lower: r.confidenceLower ? Number(r.confidenceLower) : undefined,
      confidence_upper: r.confidenceUpper ? Number(r.confidenceUpper) : undefined,
    }))

    return NextResponse.json({ actuals: actualPoints, forecasts: forecastPoints })
  } catch (error) {
    console.error('Failed to fetch cash flow data:', error)
    return NextResponse.json({ error: 'Failed to fetch cash flow data' }, { status: 500 })
  }
})
