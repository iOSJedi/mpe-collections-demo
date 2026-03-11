import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth-middleware'
import { db } from '@/db'
import { insightCards } from '@/db/schema'
import { eq, desc, sql } from 'drizzle-orm'

export const GET = withAuth(async (_request: NextRequest) => {
  try {
    const cards = await db
      .select()
      .from(insightCards)
      .where(eq(insightCards.isActive, true))
      .orderBy(
        sql`CASE severity WHEN 'alert' THEN 1 WHEN 'warning' THEN 2 WHEN 'opportunity' THEN 3 ELSE 4 END`,
        desc(insightCards.createdAt)
      )

    const insights = cards.map((c) => ({
      id: c.id,
      severity: c.severity,
      title: c.title,
      body: c.body,
      action: c.action,
      related_intent: c.relatedIntent,
      related_params: c.relatedParams,
      created_at: c.createdAt?.toISOString() ?? null,
    }))

    return NextResponse.json({ insights })
  } catch (error) {
    console.error('Failed to fetch insights:', error)
    return NextResponse.json({ error: 'Failed to fetch insights' }, { status: 500 })
  }
})
