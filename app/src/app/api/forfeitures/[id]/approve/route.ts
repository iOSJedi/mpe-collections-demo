import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth-middleware'
import { db } from '@/db'
import { sql } from 'drizzle-orm'

interface ApproveBody {
  amount?: number
  notes?: string
}

// POST /api/forfeitures/[id]/approve
// Approves a forfeiture: reduces deposit balance, marks invoice as FORFEITED,
// optionally reduces invoice balance_remaining
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
    const body: ApproveBody = await request.json().catch(() => ({}))
    const { amount: bodyAmount, notes } = body

    // Find the forfeiture
    const forfeitureResult = await db.execute(
      sql`SELECT forfeiture_id, deposit_id, invoice_id, amount, status
          FROM deposit_forfeitures_col
          WHERE forfeiture_id = ${forfeitureId}`
    )
    const forfeitureRows = forfeitureResult as unknown as {
      forfeiture_id: number
      deposit_id: number
      invoice_id: number
      amount: string
      status: string
    }[]

    if (!forfeitureRows.length) {
      return NextResponse.json({ error: 'Forfeiture not found' }, { status: 404 })
    }

    const forfeiture = forfeitureRows[0]
    if (forfeiture.status !== 'FLAGGED') {
      return NextResponse.json({ error: 'Forfeiture is not in FLAGGED status' }, { status: 400 })
    }

    // Determine forfeiture amount to apply
    const applyAmount = typeof bodyAmount === 'number' && bodyAmount > 0
      ? bodyAmount
      : Number(forfeiture.amount)

    const reviewedBy = user.email ?? user.uid
    const reviewedAt = new Date()

    // Update forfeiture status to APPROVED
    await db.execute(
      sql`UPDATE deposit_forfeitures_col
          SET status = 'APPROVED',
              reviewed_by = ${reviewedBy},
              reviewed_at = ${reviewedAt.toISOString()},
              notes = ${notes ?? null}
          WHERE forfeiture_id = ${forfeitureId}`
    )

    // Reduce security deposit current_balance by the forfeiture amount
    await db.execute(
      sql`UPDATE security_deposits_col
          SET current_balance = current_balance - ${applyAmount}
          WHERE deposit_id = ${forfeiture.deposit_id}`
    )

    // Update invoice deposit_forfeiture_flag to FORFEITED
    await db.execute(
      sql`UPDATE invoices_col
          SET deposit_forfeiture_flag = 'FORFEITED'
          WHERE invoice_id = ${forfeiture.invoice_id}`
    )

    // Reduce invoice balance_remaining by the forfeiture amount
    await db.execute(
      sql`UPDATE invoices_col
          SET balance_remaining = GREATEST(0, balance_remaining - ${applyAmount})
          WHERE invoice_id = ${forfeiture.invoice_id}`
    )

    return NextResponse.json({
      success: true,
      forfeitureId,
      status: 'APPROVED',
      amountApplied: applyAmount,
      reviewedBy,
      reviewedAt: reviewedAt.toISOString(),
    })
  } catch (error) {
    console.error('Failed to approve forfeiture:', error)
    return NextResponse.json({ error: 'Failed to approve forfeiture' }, { status: 500 })
  }
}
