import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth-middleware'
import { db } from '@/db'
import { incomingPayments, invoices } from '@/db/schema'
import { sql, eq, inArray } from 'drizzle-orm'

export const GET = withAuth(async (_request: NextRequest) => {
  try {
    const collectedRows = await db
      .select({
        month: sql<string>`to_char(${incomingPayments.paymentDate}, 'YYYY-MM')`,
        collected: sql<string>`SUM(${incomingPayments.amount}::numeric)`,
      })
      .from(incomingPayments)
      .where(eq(incomingPayments.status, 'CONFIRMED'))
      .groupBy(sql`to_char(${incomingPayments.paymentDate}, 'YYYY-MM')`)
      .orderBy(sql`to_char(${incomingPayments.paymentDate}, 'YYYY-MM')`)

    const outstandingRows = await db
      .select({
        month: sql<string>`to_char(${invoices.dueDate}, 'YYYY-MM')`,
        outstanding: sql<string>`SUM(${invoices.balanceRemaining}::numeric)`,
      })
      .from(invoices)
      .where(inArray(invoices.status, ['PENDING', 'OVERDUE', 'PARTIAL']))
      .groupBy(sql`to_char(${invoices.dueDate}, 'YYYY-MM')`)
      .orderBy(sql`to_char(${invoices.dueDate}, 'YYYY-MM')`)

    const monthMap = new Map<string, { collected: number; outstanding: number }>()

    for (const row of collectedRows) {
      monthMap.set(row.month, { collected: Number(row.collected), outstanding: 0 })
    }

    for (const row of outstandingRows) {
      const existing = monthMap.get(row.month) ?? { collected: 0, outstanding: 0 }
      existing.outstanding = Number(row.outstanding)
      monthMap.set(row.month, existing)
    }

    const trend = Array.from(monthMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, data]) => ({ month, ...data }))

    return NextResponse.json({ trend })
  } catch (error) {
    console.error('Failed to fetch collections trend:', error)
    return NextResponse.json({ error: 'Failed to fetch collections trend' }, { status: 500 })
  }
})
