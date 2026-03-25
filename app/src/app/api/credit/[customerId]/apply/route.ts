import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth-middleware'
import { db } from '@/db'
import { creditLedger, customers, invoices } from '@/db/schema'
import { sql, eq } from 'drizzle-orm'

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
    const { invoiceId, amount } = body

    if (!invoiceId || typeof invoiceId !== 'number') {
      return NextResponse.json({ error: 'invoiceId is required and must be a number' }, { status: 400 })
    }
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
        error: 'Insufficient credit balance',
        creditBalance: currentBalance,
      }, { status: 400 })
    }

    // Check invoice exists and belongs to the customer
    const invoiceResult = await db.execute(
      sql`SELECT invoice_id, customer_id, balance_remaining, status FROM invoices_col WHERE invoice_id = ${invoiceId}`
    )
    const invoiceRows = invoiceResult as unknown as { invoice_id: number; customer_id: number; balance_remaining: string; status: string }[]
    if (!invoiceRows.length) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })

    const invoice = invoiceRows[0]
    if (invoice.customer_id !== cid) {
      return NextResponse.json({ error: 'Invoice does not belong to this customer' }, { status: 403 })
    }
    if (invoice.status === 'PAID') {
      return NextResponse.json({ error: 'Invoice is already paid' }, { status: 400 })
    }

    const balanceRemaining = Number(invoice.balance_remaining)
    const applyAmount = Math.min(amount, balanceRemaining)
    const newInvoiceBalance = balanceRemaining - applyAmount
    const newInvoiceStatus = newInvoiceBalance <= 0 ? 'PAID' : 'PARTIAL'

    // Insert DEBIT entry in credit_ledger_col
    await db.insert(creditLedger).values({
      customerId: cid,
      type: 'DEBIT',
      amount: String(applyAmount),
      description: `Credit applied to invoice #${invoiceId}`,
      invoiceId,
    })

    // Reduce customer credit balance
    await db.execute(
      sql`UPDATE customers_col SET credit_balance = credit_balance - ${applyAmount} WHERE customer_id = ${cid}`
    )

    // Update invoice balance and status
    await db.execute(
      sql`UPDATE invoices_col SET balance_remaining = ${newInvoiceBalance}, status = ${newInvoiceStatus} WHERE invoice_id = ${invoiceId}`
    )

    // Fetch updated balance
    const updatedBalanceResult = await db.execute(
      sql`SELECT credit_balance FROM customers_col WHERE customer_id = ${cid}`
    )
    const updatedRows = updatedBalanceResult as unknown as { credit_balance: string }[]

    return NextResponse.json({
      success: true,
      creditBalance: Number(updatedRows[0].credit_balance),
      amountApplied: applyAmount,
      invoiceId,
      invoiceStatus: newInvoiceStatus,
      invoiceBalanceRemaining: newInvoiceBalance,
    })
  } catch (error) {
    console.error('Failed to apply credit:', error)
    return NextResponse.json({ error: 'Failed to apply credit' }, { status: 500 })
  }
}
