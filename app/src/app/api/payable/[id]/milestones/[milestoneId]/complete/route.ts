import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth-middleware'
import { db } from '@/db'
import { poMilestones } from '@/db/schema'
import { eq, and, sql } from 'drizzle-orm'
import { invalidateCache } from '@/lib/cache'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; milestoneId: string }> }
) {
  const user = await verifyToken(request)
  if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })

  try {
    const { id, milestoneId } = await params
    const poId = parseInt(id, 10)
    const mId = parseInt(milestoneId, 10)

    if (isNaN(poId) || isNaN(mId)) {
      return NextResponse.json({ error: 'Invalid PO ID or milestone ID' }, { status: 400 })
    }

    const [updated] = await db
      .update(poMilestones)
      .set({
        status: 'COMPLETED',
        completedAt: sql`now()`,
      })
      .where(
        and(
          eq(poMilestones.milestoneId, mId),
          eq(poMilestones.poId, poId)
        )
      )
      .returning()

    if (!updated) {
      return NextResponse.json({ error: 'Milestone not found' }, { status: 404 })
    }

    invalidateCache('supplier-detail')
    return NextResponse.json({
      milestoneId: updated.milestoneId,
      poId: updated.poId,
      label: updated.label,
      percentage: Number(updated.percentage),
      amount: Number(updated.amount),
      status: updated.status,
      completedAt: updated.completedAt ? updated.completedAt.toISOString() : null,
      paidAt: updated.paidAt ? updated.paidAt.toISOString() : null,
      paymentReference: updated.paymentReference ?? null,
      sortOrder: updated.sortOrder,
    })
  } catch (error) {
    console.error('Failed to mark milestone complete:', error)
    return NextResponse.json({ error: 'Failed to mark milestone complete' }, { status: 500 })
  }
}
