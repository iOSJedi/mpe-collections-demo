import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth-middleware'
import { db } from '@/db'
import { creditLedger } from '@/db/schema'
import { sql } from 'drizzle-orm'
import { invalidateCache } from '@/lib/cache'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ customerId: string }> }
) {
  const user = await verifyToken(request)
  if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })

  const { customerId } = await params
  const cid = parseInt(customerId, 10)
  if (isNaN(cid)) return NextResponse.json({ error: 'Invalid customer ID' }, { status: 400 })

  try {
    const body = await request.json()
    const { amount } = body

    if (!amount || typeof amount !== 'number' || amount <= 0) {
      return NextResponse.json({ error: 'amount must be a positive number' }, { status: 400 })
    }

    // Check customer credit balance
    const balanceResult = await db.execute(
      sql`SELECT credit_balance FROM customers_col WHERE customer_id = ${cid}`
    )
    const balanceRows = balanceResult as unknown as { credit_balance: string }[]
    if (!balanceRows.length) return NextResponse.json({ error: 'Customer not found' }, { status: 404 })

    const currentBalance = Number(balanceRows[0].credit_balance)
    if (currentBalance < amount) {
      return NextResponse.json({
        error: 'Refund amount exceeds credit balance',
        creditBalance: currentBalance,
      }, { status: 400 })
    }

    // Insert REFUND entry in credit_ledger_col
    await db.insert(creditLedger).values({
      customerId: cid,
      type: 'REFUND',
      amount: String(amount),
      description: `Refund issued for customer #${cid}`,
    })

    // Reduce customer credit balance
    await db.execute(
      sql`UPDATE customers_col SET credit_balance = credit_balance - ${amount} WHERE customer_id = ${cid}`
    )

    // Fetch updated balance
    const updatedBalanceResult = await db.execute(
      sql`SELECT credit_balance FROM customers_col WHERE customer_id = ${cid}`
    )
    const updatedRows = updatedBalanceResult as unknown as { credit_balance: string }[]

    invalidateCache('customer-detail')
    invalidateCache('customer-breakdown')
    return NextResponse.json({
      success: true,
      creditBalance: Number(updatedRows[0].credit_balance),
      amountRefunded: amount,
    })
  } catch (error) {
    console.error('Failed to issue refund:', error)
    return NextResponse.json({ error: 'Failed to issue refund' }, { status: 500 })
  }
}
