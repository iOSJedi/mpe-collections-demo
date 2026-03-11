import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth-middleware'
import { db } from '@/db'
import { cashFlowForecasts } from '@/db/schema'
import { asc } from 'drizzle-orm'

export const GET = withAuth(async (_request: NextRequest) => {
  try {
    const rows = await db
      .select()
      .from(cashFlowForecasts)
      .orderBy(asc(cashFlowForecasts.forecastDate))

    const forecasts = rows.map((r) => ({
      forecast_date: r.forecastDate,
      predicted_inflow: Number(r.predictedInflow),
      predicted_outflow: Number(r.predictedOutflow),
      confidence_lower: r.confidenceLower ? Number(r.confidenceLower) : undefined,
      confidence_upper: r.confidenceUpper ? Number(r.confidenceUpper) : undefined,
    }))

    return NextResponse.json({ forecasts })
  } catch (error) {
    console.error('Failed to fetch cash flow forecasts:', error)
    return NextResponse.json({ error: 'Failed to fetch cash flow forecasts' }, { status: 500 })
  }
})
