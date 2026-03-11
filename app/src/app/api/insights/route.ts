import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth-middleware'
import { db } from '@/db'
import { insightCards } from '@/db/schema'
import { desc, sql } from 'drizzle-orm'

export const GET = withAuth(async (_request: NextRequest) => {
  try {
    const cards = await db
      .select()
      .from(insightCards)
      .where(sql`${insightCards.isActive} = true`)
      .orderBy(
        sql`CASE ${insightCards.severity} WHEN 'CRITICAL' THEN 1 WHEN 'HIGH' THEN 2 WHEN 'MEDIUM' THEN 3 WHEN 'LOW' THEN 4 WHEN 'INFO' THEN 5 ELSE 6 END`,
        desc(insightCards.createdAt)
      )

    const insights = cards.map((c) => ({
      id: c.id,
      severity: c.severity,
      title: c.title,
      body: c.body,
      action: c.action,
      related_entity_type: c.relatedEntityType,
      related_entity_id: c.relatedEntityId,
      related_params: c.relatedParams,
      created_at: c.createdAt ? String(c.createdAt) : null,
    }))

    return NextResponse.json({ insights })
  } catch (error) {
    console.error('Failed to fetch insights:', error)
    return NextResponse.json({ insights: [] })
  }
})
