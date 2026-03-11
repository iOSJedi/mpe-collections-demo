import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { invoices, contracts, customers } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { verifyQrToken } from '@/lib/jwt'

// POST /api/pay/meta — Verify QR token and return payment page data including DB IDs
// Body: { token: string }
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { token } = body

    if (!token) {
      return NextResponse.json({ error: 'token is required' }, { status: 400 })
    }

    // Verify JWT token
    let payload
    try {
      payload = verifyQrToken(token)
    } catch {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 })
    }

    // Look up the invoice with joined contract and customer data
    const result = await db
      .select({
        invoiceId: invoices.invoiceId,
        customerId: invoices.customerId,
        invoiceNumber: invoices.invoiceNumber,
        dueDate: invoices.dueDate,
        amount: invoices.amount,
        balanceRemaining: invoices.balanceRemaining,
        contractNumber: contracts.contractNumber,
        accountNumber: customers.accountNumber,
        customerName: customers.name,
      })
      .from(invoices)
      .innerJoin(contracts, eq(invoices.contractId, contracts.contractId))
      .innerJoin(customers, eq(invoices.customerId, customers.customerId))
      .where(eq(invoices.invoiceNumber, payload.inv))
      .limit(1)

    if (!result.length) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }

    const invoice = result[0]

    return NextResponse.json({
      invoiceId: invoice.invoiceId,
      customerId: invoice.customerId,
      invoice_number: invoice.invoiceNumber,
      contract_number: invoice.contractNumber,
      account_number: invoice.accountNumber,
      customer_name: invoice.customerName,
      due_date: invoice.dueDate,
      amount: Number(invoice.amount),
      balance_remaining: Number(invoice.balanceRemaining),
    })
  } catch (error) {
    console.error('Failed to load payment meta:', error)
    return NextResponse.json({ error: 'Failed to load payment details' }, { status: 500 })
  }
}
