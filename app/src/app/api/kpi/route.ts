import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth-middleware'
import { db } from '@/db'
import { sql } from 'drizzle-orm'

export const GET = withAuth(async (_request: NextRequest) => {
  try {
    const [
      receivablesResult,
      overdueReceivablesResult,
      dsoResult,
      blockedInvoicesResult,
      totalCustomersResult,
      overdueCustomersResult,
      collectionRateResult,
      totalPayablesResult,
    ] = await Promise.all([
      // total_receivables: SUM(balance_remaining) from invoices where status != 'PAID'
      db.execute(sql`
        SELECT COALESCE(SUM(balance_remaining::numeric), 0) AS total_receivables
        FROM invoices_col
        WHERE status != 'PAID'
      `),

      // overdue_receivables: SUM(balance_remaining) where due_date < NOW() and status != 'PAID'
      db.execute(sql`
        SELECT COALESCE(SUM(balance_remaining::numeric), 0) AS overdue_receivables
        FROM invoices_col
        WHERE due_date < CURRENT_DATE
          AND status != 'PAID'
      `),

      // dso: AVG(payment_date - issued_at) from paid invoices (days)
      db.execute(sql`
        SELECT COALESCE(
          ROUND(AVG(
            EXTRACT(EPOCH FROM (ip.payment_date - i.issued_at)) / 86400
          )::numeric, 1),
          0
        ) AS dso
        FROM invoices_col i
        JOIN incoming_payments_col ip ON ip.invoice_id = i.invoice_id
        WHERE i.status = 'PAID'
          AND ip.status = 'CONFIRMED'
      `),

      // blocked_invoices: COUNT(*) from three_way_matches_col where match_status = 'MISMATCH'
      db.execute(sql`
        SELECT COUNT(*) AS blocked_invoices
        FROM three_way_matches_col
        WHERE match_status = 'MISMATCH'
      `),

      // total_customers: COUNT(*) from customers_col
      db.execute(sql`
        SELECT COUNT(*) AS total_customers
        FROM customers_col
      `),

      // overdue_customers: COUNT(DISTINCT customer_id) from invoices_col where status = 'OVERDUE'
      db.execute(sql`
        SELECT COUNT(DISTINCT customer_id) AS overdue_customers
        FROM invoices_col
        WHERE status = 'OVERDUE'
      `),

      // collection_rate: paid invoices count / total invoices count
      db.execute(sql`
        SELECT
          COUNT(CASE WHEN status = 'PAID' THEN 1 END)::numeric AS paid_count,
          COUNT(*)::numeric AS total_count
        FROM invoices_col
      `),

      // total_payables: SUM(amount - amount_paid) from supplier_invoices_col where payment_status != 'PAID'
      db.execute(sql`
        SELECT COALESCE(SUM((amount::numeric - amount_paid::numeric)), 0) AS total_payables
        FROM supplier_invoices_col
        WHERE payment_status != 'PAID'
      `),
    ])

    const paidCount = Number(collectionRateResult[0]?.paid_count ?? 0)
    const totalCount = Number(collectionRateResult[0]?.total_count ?? 0)
    const collectionRate = totalCount === 0 ? 0 : paidCount / totalCount

    return NextResponse.json({
      total_receivables: Number(receivablesResult[0]?.total_receivables ?? 0),
      overdue_receivables: Number(overdueReceivablesResult[0]?.overdue_receivables ?? 0),
      dso: Number(dsoResult[0]?.dso ?? 0),
      blocked_invoices: Number(blockedInvoicesResult[0]?.blocked_invoices ?? 0),
      total_customers: Number(totalCustomersResult[0]?.total_customers ?? 0),
      overdue_customers: Number(overdueCustomersResult[0]?.overdue_customers ?? 0),
      collection_rate: collectionRate,
      total_payables: Number(totalPayablesResult[0]?.total_payables ?? 0),
    })
  } catch (error) {
    console.error('Failed to fetch KPIs:', error)
    return NextResponse.json({ error: 'Failed to fetch KPIs' }, { status: 500 })
  }
})
