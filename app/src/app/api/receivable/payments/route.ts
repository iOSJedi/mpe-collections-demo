import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth-middleware'
import { db } from '@/db'
import { incomingPayments, customers, invoices } from '@/db/schema'
import { eq, ilike, and, gte, lte, or, desc } from 'drizzle-orm'
import type { PaymentSummary } from '@/types'

export const GET = withAuth(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url)
    const paymentMethod = searchParams.get('payment_method')
    const status = searchParams.get('status')
    const customerId = searchParams.get('customerId')
    const from = searchParams.get('from')
    const to = searchParams.get('to')
    const search = searchParams.get('search')
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))
    const limit = Math.min(200, Math.max(1, parseInt(searchParams.get('limit') ?? '50', 10)))
    const offset = (page - 1) * limit

    const conditions = []

    if (paymentMethod) {
      conditions.push(eq(incomingPayments.paymentMethod, paymentMethod))
    }

    if (status) {
      conditions.push(eq(incomingPayments.status, status))
    }

    if (customerId) {
      const id = parseInt(customerId, 10)
      if (!isNaN(id)) {
        conditions.push(eq(incomingPayments.customerId, id))
      }
    }

    if (from) {
      conditions.push(gte(incomingPayments.paymentDate, new Date(from)))
    }

    if (to) {
      conditions.push(lte(incomingPayments.paymentDate, new Date(to)))
    }

    if (search) {
      conditions.push(
        or(
          ilike(incomingPayments.referenceNumber, `%${search}%`),
          ilike(customers.name, `%${search}%`),
        ),
      )
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined

    const rows = await db
      .select({
        payment_id: incomingPayments.paymentId,
        invoice_number: invoices.invoiceNumber,
        customer_name: customers.name,
        amount: incomingPayments.amount,
        payment_method: incomingPayments.paymentMethod,
        payment_date: incomingPayments.paymentDate,
        reference_number: incomingPayments.referenceNumber,
        status: incomingPayments.status,
      })
      .from(incomingPayments)
      .innerJoin(customers, eq(customers.customerId, incomingPayments.customerId))
      .innerJoin(invoices, eq(invoices.invoiceId, incomingPayments.invoiceId))
      .where(whereClause)
      .orderBy(desc(incomingPayments.paymentDate))
      .limit(limit)
      .offset(offset)

    const result: (PaymentSummary & { customer_name: string })[] = rows.map((r) => ({
      payment_id: r.payment_id,
      invoice_number: r.invoice_number,
      customer_name: r.customer_name,
      amount: Number(r.amount),
      payment_method: r.payment_method,
      payment_date: r.payment_date ? String(r.payment_date) : '',
      reference_number: r.reference_number ?? null,
      status: r.status,
    }))

    return NextResponse.json(result)
  } catch (error) {
    console.error('Failed to fetch incoming payments:', error)
    return NextResponse.json({ error: 'Failed to fetch incoming payments' }, { status: 500 })
  }
})
