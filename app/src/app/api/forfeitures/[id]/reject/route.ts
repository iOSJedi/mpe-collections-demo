import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth-middleware'
import { db } from '@/db'
import { sql } from 'drizzle-orm'
import { invalidateCache } from '@/lib/cache'

interface RejectBody {
  notes: string
}

// POST /api/forfeitures/[id]/reject
// Rejects a forfeiture: sets status to REJECTED, clears invoice deposit_forfeiture_flag
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await verifyToken(request)
  if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })

  const { id } = await params
  const forfeitureId = parseInt(id, 10)
  if (isNaN(forfeitureId)) return NextResponse.json({ error: 'Invalid forfeiture ID' }, { status: 400 })

  try {
    const body: RejectBody = await request.json()
    const { notes } = body

    if (!notes || typeof notes !== 'string') {
      return NextResponse.json({ error: 'notes is required' }, { status: 400 })
    }

    // Find the forfeiture
    const forfeitureResult = await db.execute(
      sql`SELECT forfeiture_id, invoice_id, status
          FROM deposit_forfeitures_col
          WHERE forfeiture_id = ${forfeitureId}`
    )
    const forfeitureRows = forfeitureResult as unknown as {
      forfeiture_id: number
      invoice_id: number
      status: string
    }[]

    if (!forfeitureRows.length) {
      return NextResponse.json({ error: 'Forfeiture not found' }, { status: 404 })
    }

    const forfeiture = forfeitureRows[0]
    if (forfeiture.status !== 'FLAGGED') {
      return NextResponse.json({ error: 'Forfeiture is not in FLAGGED status' }, { status: 400 })
    }

    const reviewedBy = user.email ?? user.uid
    const reviewedAt = new Date()

    // Update forfeiture status to REJECTED
    await db.execute(
      sql`UPDATE deposit_forfeitures_col
          SET status = 'REJECTED',
              reviewed_by = ${reviewedBy},
              reviewed_at = ${reviewedAt.toISOString()},
              notes = ${notes}
          WHERE forfeiture_id = ${forfeitureId}`
    )

    // Clear invoice deposit_forfeiture_flag
    await db.execute(
      sql`UPDATE invoices_col
          SET deposit_forfeiture_flag = NULL
          WHERE invoice_id = ${forfeiture.invoice_id}`
    )

    invalidateCache('customer-detail')
    invalidateCache('customer-breakdown')
    return NextResponse.json({
      success: true,
      forfeitureId,
      status: 'REJECTED',
      reviewedBy,
      reviewedAt: reviewedAt.toISOString(),
      notes,
    })
  } catch (error) {
    console.error('Failed to reject forfeiture:', error)
    return NextResponse.json({ error: 'Failed to reject forfeiture' }, { status: 500 })
  }
}
