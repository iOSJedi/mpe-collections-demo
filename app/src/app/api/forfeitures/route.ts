import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth-middleware'
import { db } from '@/db'
import { sql } from 'drizzle-orm'
import type { DepositForfeiture } from '@/types'

// GET /api/forfeitures
// List all forfeitures joined with customers, invoices, and deposits
// Optional query param: ?status=FLAGGED
export const GET = withAuth(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url)
    const statusParam = searchParams.get('status')

    const whereClause = statusParam
      ? sql`WHERE df.status = ${statusParam}`
      : sql``

    const result = await db.execute(
      sql`SELECT
            df.forfeiture_id,
            df.deposit_id,
            df.customer_id,
            df.invoice_id,
            df.amount,
            df.status,
            df.flagged_at,
            df.reviewed_by,
            df.reviewed_at,
            df.notes,
            i.invoice_number,
            i.due_date,
            c.name AS customer_name,
            c.property_name,
            sd.current_balance AS deposit_balance
          FROM deposit_forfeitures_col df
          INNER JOIN customers_col c ON df.customer_id = c.customer_id
          INNER JOIN invoices_col i ON df.invoice_id = i.invoice_id
          INNER JOIN security_deposits_col sd ON df.deposit_id = sd.deposit_id
          ${whereClause}
          ORDER BY df.flagged_at DESC`
    )

    const rows = result as unknown as {
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
      invoice_number: string
      due_date: string
      customer_name: string
      property_name: string | null
      deposit_balance: string
    }[]

    const today = new Date()
    const forfeitures: DepositForfeiture[] = rows.map((r) => {
      const dueDate = new Date(r.due_date)
      const daysOverdue = Math.max(0, Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)))

      return {
        forfeitureId: r.forfeiture_id,
        depositId: r.deposit_id,
        customerId: r.customer_id,
        invoiceId: r.invoice_id,
        invoiceNumber: r.invoice_number,
        customerName: r.customer_name,
        propertyName: r.property_name ?? undefined,
        amount: Number(r.amount),
        status: r.status as 'FLAGGED' | 'APPROVED' | 'REJECTED',
        flaggedAt: String(r.flagged_at),
        reviewedBy: r.reviewed_by ?? null,
        reviewedAt: r.reviewed_at ? String(r.reviewed_at) : null,
        notes: r.notes ?? null,
        daysOverdue,
        depositBalance: Number(r.deposit_balance),
      }
    })

    return NextResponse.json(forfeitures)
  } catch (error) {
    console.error('Failed to fetch forfeitures:', error)
    return NextResponse.json({ error: 'Failed to fetch forfeitures' }, { status: 500 })
  }
})
