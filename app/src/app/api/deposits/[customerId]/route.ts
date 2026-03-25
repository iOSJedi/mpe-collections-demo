import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth-middleware'
import { db } from '@/db'
import { sql } from 'drizzle-orm'

// GET /api/deposits/[customerId]
// Returns security deposit info and forfeiture history for a customer
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ customerId: string }> }
) {
  const user = await verifyToken(request)
  if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })

  const { customerId } = await params
  const cid = parseInt(customerId, 10)
  if (isNaN(cid)) return NextResponse.json({ error: 'Invalid customer ID' }, { status: 400 })

  try {
    // Get security deposit
    const depositResult = await db.execute(
      sql`SELECT deposit_id, initial_amount, current_balance
          FROM security_deposits_col
          WHERE customer_id = ${cid}`
    )
    const depositRows = depositResult as unknown as {
      deposit_id: number
      initial_amount: string
      current_balance: string
    }[]

    const deposit = depositRows.length > 0
      ? {
          depositId: depositRows[0].deposit_id,
          initialAmount: Number(depositRows[0].initial_amount),
          currentBalance: Number(depositRows[0].current_balance),
        }
      : null

    // Get forfeitures joined with invoices for invoice_number
    const forfeituresResult = await db.execute(
      sql`SELECT df.forfeiture_id, df.deposit_id, df.customer_id, df.invoice_id,
                 df.amount, df.status, df.flagged_at, df.reviewed_by, df.reviewed_at, df.notes,
                 i.invoice_number
          FROM deposit_forfeitures_col df
          LEFT JOIN invoices_col i ON df.invoice_id = i.invoice_id
          WHERE df.customer_id = ${cid}
          ORDER BY df.flagged_at DESC`
    )
    const forfeitureRows = forfeituresResult as unknown as {
      forfeiture_id: number
      deposit_id: number
      customer_id: number
      invoice_id: number
      amount: string
      status: string
      flagged_at: string
      reviewed_by: string | null
      reviewed_at: string | null
      notes: string | null
      invoice_number: string | null
    }[]

    const forfeitures = forfeitureRows.map((r) => ({
      forfeitureId: r.forfeiture_id,
      depositId: r.deposit_id,
      customerId: r.customer_id,
      invoiceId: r.invoice_id,
      invoiceNumber: r.invoice_number ?? undefined,
      amount: Number(r.amount),
      status: r.status,
      flaggedAt: String(r.flagged_at),
      reviewedBy: r.reviewed_by ?? null,
      reviewedAt: r.reviewed_at ? String(r.reviewed_at) : null,
      notes: r.notes ?? null,
    }))

    return NextResponse.json({ deposit, forfeitures })
  } catch (error) {
    console.error('Failed to fetch deposit info:', error)
    return NextResponse.json({ error: 'Failed to fetch deposit info' }, { status: 500 })
  }
}
