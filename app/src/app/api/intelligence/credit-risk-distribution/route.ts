import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth-middleware'
import { db } from '@/db'
import { creditRiskScores } from '@/db/schema'
import { sql } from 'drizzle-orm'

export const GET = withAuth(async (_request: NextRequest) => {
  try {
    const rows = await db
      .select({
        risk_level: creditRiskScores.riskLevel,
        count: sql<number>`count(*)::int`,
      })
      .from(creditRiskScores)
      .groupBy(creditRiskScores.riskLevel)

    return NextResponse.json({ distribution: rows })
  } catch (error) {
    console.error('Failed to fetch credit risk distribution:', error)
    return NextResponse.json({ error: 'Failed to fetch credit risk distribution' }, { status: 500 })
  }
})
