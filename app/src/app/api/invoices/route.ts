import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth-middleware'
import { db } from '@/db'
import { invoices, contracts } from '@/db/schema'
import { eq } from 'drizzle-orm'

// GET /api/invoices?customerId=N
// Returns invoices for a specific customer, joined with contracts for contract_number
export const GET = withAuth(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url)
    const customerIdParam = searchParams.get('customerId')

    if (!customerIdParam) {
      return NextResponse.json({ error: 'customerId is required' }, { status: 400 })
    }

    const customerIdNum = Number(customerIdParam)
    if (isNaN(customerIdNum)) {
      return NextResponse.json({ error: 'customerId must be a number' }, { status: 400 })
    }

    const rows = await db
      .select({
        invoice_id: invoices.invoiceId,
        invoice_number: invoices.invoiceNumber,
        contract_number: contracts.contractNumber,
        billing_period_start: invoices.billingPeriodStart,
        billing_period_end: invoices.billingPeriodEnd,
        due_date: invoices.dueDate,
        amount: invoices.amount,
        balance_remaining: invoices.balanceRemaining,
        status: invoices.status,
      })
      .from(invoices)
      .innerJoin(contracts, eq(invoices.contractId, contracts.contractId))
      .where(eq(invoices.customerId, customerIdNum))
      .orderBy(invoices.dueDate)

    const result = rows.map((r) => ({
      invoice_id: r.invoice_id,
      invoice_number: r.invoice_number,
      contract_number: r.contract_number,
      billing_period_start: r.billing_period_start,
      billing_period_end: r.billing_period_end,
      due_date: r.due_date,
      amount: Number(r.amount),
      balance_remaining: Number(r.balance_remaining),
      status: r.status,
    }))

    return NextResponse.json(result)
  } catch (error) {
    console.error('Failed to fetch invoices:', error)
    return NextResponse.json({ error: 'Failed to fetch invoices' }, { status: 500 })
  }
})
