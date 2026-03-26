import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth-middleware'
import { db } from '@/db'
import { sql } from 'drizzle-orm'

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

    // Build WHERE clauses
    const conditions: string[] = []

    if (paymentMethod) conditions.push(`ip.payment_method = '${paymentMethod.replace(/'/g, "''")}'`)
    if (status) conditions.push(`ip.status = '${status.replace(/'/g, "''")}'`)
    if (customerId) {
      const id = parseInt(customerId, 10)
      if (!isNaN(id)) conditions.push(`ip.customer_id = ${id}`)
    }
    if (from) conditions.push(`ip.payment_date >= '${from.replace(/'/g, "''")}'`)
    if (to) conditions.push(`ip.payment_date <= '${to.replace(/'/g, "''")}'`)
    if (search) {
      const escaped = search.replace(/'/g, "''")
      conditions.push(`(ip.reference_number ILIKE '%${escaped}%' OR c.name ILIKE '%${escaped}%')`)
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

    const result = await db.execute(sql.raw(`SELECT ip.payment_id, COALESCE(i.invoice_number, '') as invoice_number, c.name as customer_name, ip.amount, ip.payment_method, ip.payment_date, ip.reference_number, ip.status, ip.check_number, ip.clearance_date FROM incoming_payments_col ip JOIN customers_col c ON c.customer_id = ip.customer_id LEFT JOIN invoices_col i ON i.invoice_id = ip.invoice_id ${whereClause} ORDER BY ip.payment_date DESC LIMIT ${limit} OFFSET ${offset}`))

    type PaymentRow = { payment_id: number; invoice_number: string; customer_name: string; amount: string; payment_method: string; payment_date: string; reference_number: string | null; status: string; check_number: string | null; clearance_date: string | null }
    const rows = result as unknown as PaymentRow[]

    const mapped = rows.map((r) => ({
      payment_id: r.payment_id,
      invoice_number: r.invoice_number,
      customer_name: r.customer_name,
      amount: Number(r.amount),
      payment_method: r.payment_method,
      payment_date: r.payment_date ? String(r.payment_date) : '',
      reference_number: r.reference_number ?? null,
      status: r.status,
      check_number: r.check_number ?? null,
      clearance_date: r.clearance_date ? String(r.clearance_date) : null,
    }))

    return NextResponse.json(mapped)
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error('Failed to fetch incoming payments:', msg)
    return NextResponse.json({ error: `Failed to fetch incoming payments: ${msg}` }, { status: 500 })
  }
})
