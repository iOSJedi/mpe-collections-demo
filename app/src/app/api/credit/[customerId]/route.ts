import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth-middleware'
import { db } from '@/db'
import { sql } from 'drizzle-orm'

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
    const balanceResult = await db.execute(
      sql`SELECT credit_balance FROM customers_col WHERE customer_id = ${cid}`
    )
    const balanceRows = balanceResult as unknown as { credit_balance: string }[]
    if (!balanceRows.length) return NextResponse.json({ error: 'Customer not found' }, { status: 404 })

    const ledgerResult = await db.execute(
      sql`SELECT entry_id, customer_id, type, amount, description, payment_id, invoice_id, created_at
       FROM credit_ledger_col WHERE customer_id = ${cid} ORDER BY created_at DESC`
    )
    const entries = (ledgerResult as unknown as any[]).map(r => ({
      entryId: r.entry_id,
      customerId: r.customer_id,
      type: r.type,
      amount: Number(r.amount),
      description: r.description,
      paymentId: r.payment_id,
      invoiceId: r.invoice_id,
      createdAt: String(r.created_at),
    }))

    return NextResponse.json({
      creditBalance: Number(balanceRows[0].credit_balance),
      entries,
    })
  } catch (error) {
    console.error('Failed to fetch credit balance:', error)
    return NextResponse.json({ error: 'Failed to fetch credit balance' }, { status: 500 })
  }
}
