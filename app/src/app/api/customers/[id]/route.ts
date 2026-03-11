import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth-middleware'
import { db } from '@/db'
import { sql } from 'drizzle-orm'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await verifyToken(request)
  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  const { id } = await params

  try {
    // Run all queries in parallel for performance
    const [
      customerResult,
      categoriesResult,
      brandsResult,
      monthlyResult,
      transactionsResult,
      recommendationsResult,
    ] = await Promise.all([
      // 1. Customer info + segments + churn + credit risk
      db.execute(sql`
        SELECT
          c.customer_id,
          c.customer_type,
          c.first_name,
          c.last_name,
          c.business_name,
          c.phone,
          c.email,
          c.loyalty_card_number,
          c.wholesale_member_id,
          c.barangay,
          c.municipality,
          c.registration_date,
          c.credit_limit,
          c.credit_terms_days,
          c.status,
          cs.segment_name,
          cs.rfm_recency,
          cs.rfm_frequency,
          cs.rfm_monetary,
          ch.risk_level AS churn_risk,
          ch.churn_probability,
          ch.top_risk_factor AS churn_risk_factor,
          cr.risk_level AS credit_risk_level,
          cr.credit_utilization,
          cr.outstanding_balance,
          COALESCE(agg.total_spend, 0) AS total_spend,
          COALESCE(agg.transaction_count, 0)::int AS transaction_count,
          agg.last_transaction_date
        FROM customers c
        LEFT JOIN customer_segments cs ON cs.customer_id = c.customer_id
        LEFT JOIN churn_scores ch ON ch.customer_id = c.customer_id
        LEFT JOIN credit_risk_scores cr ON cr.customer_id = c.customer_id
        LEFT JOIN (
          SELECT
            customer_id,
            SUM(total_amount::numeric) AS total_spend,
            COUNT(*) AS transaction_count,
            MAX(transaction_date) AS last_transaction_date
          FROM transactions
          GROUP BY customer_id
        ) agg ON agg.customer_id = c.customer_id
        WHERE c.customer_id = ${id}
      `),

      // 2. Top categories by spend (top 10)
      db.execute(sql`
        SELECT
          p.category,
          SUM(ti.line_total::numeric) AS total
        FROM transaction_items ti
        JOIN transactions t ON t.transaction_id = ti.transaction_id
        JOIN products p ON p.product_id = ti.product_id
        WHERE t.customer_id = ${id}
        GROUP BY p.category
        ORDER BY total DESC
        LIMIT 10
      `),

      // 3. Top brands by frequency (top 10)
      db.execute(sql`
        SELECT
          p.brand,
          COUNT(*)::int AS count
        FROM transaction_items ti
        JOIN transactions t ON t.transaction_id = ti.transaction_id
        JOIN products p ON p.product_id = ti.product_id
        WHERE t.customer_id = ${id}
        GROUP BY p.brand
        ORDER BY count DESC
        LIMIT 10
      `),

      // 4. Monthly spend trend (last 6 months relative to data)
      db.execute(sql`
        WITH max_date AS (
          SELECT date_trunc('month', MAX(transaction_date)) AS latest
          FROM transactions
          WHERE customer_id = ${id}
        )
        SELECT
          to_char(date_trunc('month', t.transaction_date), 'YYYY-MM') AS month,
          SUM(t.total_amount::numeric) AS total
        FROM transactions t, max_date m
        WHERE t.customer_id = ${id}
          AND date_trunc('month', t.transaction_date) > m.latest - interval '6 months'
        GROUP BY date_trunc('month', t.transaction_date)
        ORDER BY month
      `),

      // 5. Recent transactions (last 20, with branch names)
      db.execute(sql`
        SELECT
          t.transaction_id,
          t.transaction_date AS date,
          b.branch_name,
          t.transaction_type,
          t.total_amount,
          t.items_count
        FROM transactions t
        JOIN branches b ON b.branch_id = t.branch_id
        WHERE t.customer_id = ${id}
        ORDER BY t.transaction_date DESC
        LIMIT 20
      `),

      // 6. Recommended products from product_associations
      // Find products frequently bought with this customer's top products
      db.execute(sql`
        WITH customer_products AS (
          SELECT DISTINCT ti.product_id
          FROM transaction_items ti
          JOIN transactions t ON t.transaction_id = ti.transaction_id
          WHERE t.customer_id = ${id}
        )
        SELECT DISTINCT ON (p.product_name)
          p.product_name,
          pa.confidence_a_to_b::numeric AS confidence
        FROM product_associations pa
        JOIN customer_products cp ON cp.product_id = pa.product_a_id
        JOIN products p ON p.product_id = pa.product_b_id
        WHERE pa.product_b_id NOT IN (SELECT product_id FROM customer_products)
        ORDER BY p.product_name, pa.confidence_a_to_b DESC
        LIMIT 10
      `),
    ])

    const c = customerResult[0]
    if (!c) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
    }

    const profile = {
      customer_id: c.customer_id,
      customer_type: c.customer_type,
      first_name: c.first_name,
      last_name: c.last_name,
      business_name: c.business_name ?? null,
      phone: c.phone ?? null,
      email: c.email ?? null,
      loyalty_card_number: c.loyalty_card_number ?? null,
      wholesale_member_id: c.wholesale_member_id ?? null,
      barangay: c.barangay ?? null,
      municipality: c.municipality ?? null,
      registration_date: c.registration_date,
      credit_limit: c.credit_limit ? Number(c.credit_limit) : null,
      credit_terms_days: c.credit_terms_days ? Number(c.credit_terms_days) : null,
      status: c.status,
      segment_name: c.segment_name ?? null,
      churn_risk: c.churn_risk ?? null,
      total_spend: Number(c.total_spend),
      transaction_count: Number(c.transaction_count),
      last_transaction_date: c.last_transaction_date
        ? new Date(c.last_transaction_date as string).toISOString()
        : null,
      rfm_recency: c.rfm_recency ? Number(c.rfm_recency) : null,
      rfm_frequency: c.rfm_frequency ? Number(c.rfm_frequency) : null,
      rfm_monetary: c.rfm_monetary ? Number(c.rfm_monetary) : null,
      churn_probability: c.churn_probability ? Number(c.churn_probability) : null,
      top_risk_factor: (c.churn_risk_factor as string) ?? null,
      credit_risk_level: c.credit_risk_level ?? null,
      credit_utilization: c.credit_utilization ? Number(c.credit_utilization) : null,
      outstanding_balance: c.outstanding_balance ? Number(c.outstanding_balance) : null,
      top_categories: categoriesResult.map((r) => ({
        category: r.category as string,
        total: Number(r.total),
      })),
      top_brands: brandsResult.map((r) => ({
        brand: r.brand as string,
        count: Number(r.count),
      })),
      monthly_spend: monthlyResult.map((r) => ({
        month: r.month as string,
        total: Number(r.total),
      })),
      recent_transactions: transactionsResult.map((r) => ({
        transaction_id: r.transaction_id as string,
        date: new Date(r.date as string).toISOString(),
        branch_name: r.branch_name as string,
        transaction_type: r.transaction_type as string,
        total_amount: Number(r.total_amount),
        items_count: Number(r.items_count),
      })),
      recommended_products: recommendationsResult.map((r) => ({
        product_name: r.product_name as string,
        confidence: Number(r.confidence),
      })),
    }

    return NextResponse.json({ customer: profile })
  } catch (error) {
    console.error('Failed to fetch customer profile:', error)
    return NextResponse.json({ error: 'Failed to fetch customer profile' }, { status: 500 })
  }
}
