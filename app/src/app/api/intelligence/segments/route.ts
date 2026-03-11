import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth-middleware'
import { db } from '@/db'
import { payerSegments } from '@/db/schema'
import { sql } from 'drizzle-orm'

export const GET = withAuth(async (_request: NextRequest) => {
  try {
    const rows = await db
      .select({
        segment_name: payerSegments.segmentName,
        count: sql<number>`count(*)::int`,
      })
      .from(payerSegments)
      .groupBy(payerSegments.segmentName)
      .orderBy(sql`count(*) DESC`)

    return NextResponse.json({ segments: rows })
  } catch (error) {
    console.error('Failed to fetch payer segments:', error)
    return NextResponse.json({ error: 'Failed to fetch payer segments' }, { status: 500 })
  }
})
