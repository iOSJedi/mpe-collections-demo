import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

const PROXY_URL = process.env.SUPABASE_SQL_PROXY_URL!
const PROXY_KEY = process.env.SUPABASE_SQL_PROXY_KEY!

async function query(sqlText: string): Promise<any[]> {
  const res = await fetch(PROXY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': PROXY_KEY },
    body: JSON.stringify({ sql: sqlText, params: [], method: 'execute' }),
  })
  if (!res.ok) throw new Error(`SQL proxy error (${res.status}): ${await res.text()}`)
  const { rows } = await res.json()
  return rows
}

async function exec(sqlText: string): Promise<void> {
  await query(sqlText)
}

function sigmoid(x: number): number { return 1 / (1 + Math.exp(-x)) }
function riskBucket(score: number): string {
  if (score >= 0.75) return 'CRITICAL'
  if (score >= 0.5) return 'HIGH'
  if (score >= 0.25) return 'MEDIUM'
  return 'LOW'
}
function segmentLabel(score: number, paymentCount: number): string {
  if (paymentCount === 0) return 'New Customer'
  if (score >= 0.75) return 'Reliable Payer'
  if (score >= 0.5) return 'Occasional Late'
  if (score >= 0.3) return 'Partial Payer'
  return 'Chronic Delinquent'
}
function esc(s: string | null): string {
  if (s === null) return 'NULL'
  return `'${s.replace(/'/g, "''")}'`
}

async function main() {
  console.log('Testing connectivity...')
  const [{ cnt }] = await query('SELECT COUNT(*)::int AS cnt FROM customers_col')
  console.log(`Connected. Found ${cnt} customers.\n`)

  // 1. Payment Patterns
  console.log('1. Running payment patterns...')
  const payStats = await query(`
    WITH pay_stats AS (
      SELECT
        p.customer_id,
        AVG(EXTRACT(EPOCH FROM (p.payment_date - i.issued_at)) / 86400)::numeric(6,1) AS avg_days_to_pay,
        MODE() WITHIN GROUP (ORDER BY p.payment_method) AS preferred_method,
        MODE() WITHIN GROUP (ORDER BY EXTRACT(DAY FROM p.payment_date)::int) AS typical_payment_day,
        ROUND(
          COUNT(*) FILTER (WHERE p.amount::numeric < i.amount::numeric)::numeric
          / NULLIF(COUNT(*), 0), 2
        ) AS partial_payment_rate
      FROM incoming_payments_col p
      JOIN invoices_col i ON i.invoice_id = p.invoice_id
      GROUP BY p.customer_id
    )
    SELECT * FROM pay_stats
  `)
  if (payStats.length > 0) {
    await exec('DELETE FROM payment_patterns')
    const vals = payStats.map(r =>
      `(${r.customer_id}, ${r.avg_days_to_pay ?? 0}, ${esc(r.preferred_method ?? 'UNKNOWN')}, ${r.typical_payment_day ?? 1}, ${r.partial_payment_rate ?? 0})`
    ).join(',\n')
    await exec(`INSERT INTO payment_patterns (customer_id, avg_days_to_pay, preferred_method, typical_payment_day, partial_payment_rate) VALUES ${vals}`)
    console.log(`   Computed payment patterns for ${payStats.length} customers`)
  } else {
    console.log('   No payment data')
  }

  // 2. Payer Segmentation
  console.log('2. Running payer segmentation...')
  const custPayments = await query(`
    WITH cust_payments AS (
      SELECT
        c.customer_id,
        COUNT(p.payment_id)::int AS payment_count,
        CASE
          WHEN COUNT(p.payment_id) < 2 THEN 0
          ELSE GREATEST(0, LEAST(1,
            1 - (STDDEV(EXTRACT(EPOCH FROM (p.payment_date - LAG(p.payment_date)
                  OVER (PARTITION BY p.customer_id ORDER BY p.payment_date)))) / 86400
                 / NULLIF(AVG(EXTRACT(EPOCH FROM (p.payment_date - LAG(p.payment_date)
                   OVER (PARTITION BY p.customer_id ORDER BY p.payment_date)))) / 86400, 0))
          ))
        END::numeric(5,2) AS regularity_score,
        CASE
          WHEN COUNT(p.payment_id) = 0 THEN 0
          ELSE GREATEST(0, LEAST(1,
            AVG(p.amount::numeric) / NULLIF(AVG(i.amount::numeric), 0)
          ))
        END::numeric(5,2) AS amount_score,
        CASE
          WHEN COUNT(p.payment_id) = 0 THEN 0
          ELSE GREATEST(0, LEAST(1,
            1 - LEAST(AVG(EXTRACT(EPOCH FROM (p.payment_date - i.issued_at)) / 86400), 60) / 60
          ))
        END::numeric(5,2) AS timeliness_score
      FROM customers_col c
      LEFT JOIN invoices_col i ON i.customer_id = c.customer_id
      LEFT JOIN incoming_payments_col p ON p.invoice_id = i.invoice_id
      GROUP BY c.customer_id
    )
    SELECT * FROM cust_payments
  `)
  if (custPayments.length > 0) {
    await exec('DELETE FROM payer_segments')
    const vals = custPayments.map(r => {
      const composite = (Number(r.regularity_score) + Number(r.amount_score) + Number(r.timeliness_score)) / 3
      const segName = segmentLabel(composite, r.payment_count)
      const clusterId = composite >= 0.75 ? 0 : composite >= 0.5 ? 1 : composite >= 0.3 ? 2 : 3
      return `(${r.customer_id}, ${esc(segName)}, ${r.regularity_score}, ${r.amount_score}, ${r.timeliness_score}, ${clusterId})`
    }).join(',\n')
    await exec(`INSERT INTO payer_segments (customer_id, segment_name, regularity_score, amount_score, timeliness_score, cluster_id) VALUES ${vals}`)
    console.log(`   Segmented ${custPayments.length} customers`)
  } else {
    console.log('   No customers found')
  }

  // 3. Delinquency Scoring
  console.log('3. Running delinquency scoring...')
  const delinqFeatures = await query(`
    WITH features AS (
      SELECT
        c.customer_id,
        COALESCE(AVG(
          CASE WHEN i.status IN ('OVERDUE','PARTIAL')
               THEN GREATEST(0, CURRENT_DATE - i.due_date::date) END
        ), 0)::numeric(6,1) AS days_overdue_avg,
        COUNT(*) FILTER (
          WHERE i.status IN ('OVERDUE','PARTIAL') AND i.due_date::date < CURRENT_DATE
        )::int AS missed_payments,
        CASE
          WHEN COUNT(p.payment_id) FILTER (WHERE p.payment_date > CURRENT_TIMESTAMP - interval '90 days') >
               COUNT(p.payment_id) FILTER (WHERE p.payment_date BETWEEN CURRENT_TIMESTAMP - interval '180 days'
                                                                    AND CURRENT_TIMESTAMP - interval '90 days')
          THEN 'improving'
          WHEN COUNT(p.payment_id) FILTER (WHERE p.payment_date > CURRENT_TIMESTAMP - interval '90 days') <
               COUNT(p.payment_id) FILTER (WHERE p.payment_date BETWEEN CURRENT_TIMESTAMP - interval '180 days'
                                                                    AND CURRENT_TIMESTAMP - interval '90 days')
          THEN 'declining'
          ELSE 'stable'
        END AS payment_trend,
        CASE
          WHEN COALESCE(SUM(i.amount::numeric), 0) = 0 THEN 0
          ELSE COALESCE(SUM(i.balance_remaining::numeric), 0)
               / NULLIF(SUM(i.amount::numeric), 0)
        END::numeric(5,4) AS balance_ratio
      FROM customers_col c
      LEFT JOIN invoices_col i ON i.customer_id = c.customer_id
      LEFT JOIN incoming_payments_col p ON p.customer_id = c.customer_id
      GROUP BY c.customer_id
    )
    SELECT * FROM features
  `)
  if (delinqFeatures.length > 0) {
    await exec('DELETE FROM delinquency_scores')
    const vals = delinqFeatures.map(r => {
      const raw =
        0.35 * Math.min(Number(r.days_overdue_avg) / 90, 1) +
        0.25 * Math.min(r.missed_payments / 6, 1) +
        0.20 * (r.payment_trend === 'declining' ? 1 : r.payment_trend === 'stable' ? 0.3 : 0) +
        0.20 * Math.min(Number(r.balance_ratio), 1)
      const score = Number(sigmoid(raw * 4 - 2).toFixed(4))
      const level = riskBucket(score)
      const factors = [
        { label: 'High overdue days', val: Number(r.days_overdue_avg) / 90 },
        { label: 'Frequent missed payments', val: r.missed_payments / 6 },
        { label: 'Declining payment trend', val: r.payment_trend === 'declining' ? 1 : 0 },
        { label: 'High balance ratio', val: Number(r.balance_ratio) },
      ]
      const topFactor = factors.sort((a, b) => b.val - a.val)[0]?.label ?? null
      return `(${r.customer_id}, '${score}', ${esc(level)}, ${r.days_overdue_avg}, ${r.missed_payments}, ${esc(r.payment_trend)}, ${esc(topFactor)})`
    }).join(',\n')
    await exec(`INSERT INTO delinquency_scores (customer_id, risk_score, risk_level, days_overdue_avg, missed_payments, payment_trend, top_risk_factor) VALUES ${vals}`)
    console.log(`   Scored ${delinqFeatures.length} customers for delinquency risk`)
  } else {
    console.log('   No customer data')
  }

  // 4. Credit Risk Scoring
  console.log('4. Running credit risk scoring...')
  const creditFeatures = await query(`
    WITH features AS (
      SELECT
        c.customer_id,
        COALESCE(SUM(i.balance_remaining::numeric), 0)::numeric(12,2) AS outstanding_balance,
        CASE
          WHEN COALESCE(SUM(i.amount::numeric), 0) = 0 THEN 0
          ELSE ROUND(
            COALESCE(SUM(i.balance_remaining::numeric), 0)
            / NULLIF(SUM(i.amount::numeric), 0), 2
          )
        END::numeric(5,2) AS credit_utilization,
        COALESCE(AVG(
          CASE WHEN i.due_date::date < CURRENT_DATE
               THEN GREATEST(0, CURRENT_DATE - i.due_date::date) END
        ), 0)::numeric(6,1) AS avg_days_overdue,
        CASE
          WHEN COUNT(p.payment_id) FILTER (WHERE p.payment_date > CURRENT_TIMESTAMP - interval '90 days') >
               COUNT(p.payment_id) FILTER (WHERE p.payment_date BETWEEN CURRENT_TIMESTAMP - interval '180 days'
                                                                    AND CURRENT_TIMESTAMP - interval '90 days')
          THEN 'improving'
          WHEN COUNT(p.payment_id) FILTER (WHERE p.payment_date > CURRENT_TIMESTAMP - interval '90 days') <
               COUNT(p.payment_id) FILTER (WHERE p.payment_date BETWEEN CURRENT_TIMESTAMP - interval '180 days'
                                                                    AND CURRENT_TIMESTAMP - interval '90 days')
          THEN 'declining'
          ELSE 'stable'
        END AS payment_trend
      FROM customers_col c
      LEFT JOIN invoices_col i ON i.customer_id = c.customer_id
      LEFT JOIN incoming_payments_col p ON p.customer_id = c.customer_id
      GROUP BY c.customer_id
    )
    SELECT * FROM features
  `)
  if (creditFeatures.length > 0) {
    await exec('DELETE FROM credit_risk_scores')
    const vals = creditFeatures.map(r => {
      const raw =
        0.30 * Math.min(Number(r.credit_utilization), 1) +
        0.30 * Math.min(Number(r.avg_days_overdue) / 90, 1) +
        0.20 * (r.payment_trend === 'declining' ? 1 : r.payment_trend === 'stable' ? 0.3 : 0) +
        0.20 * Math.min(Number(r.outstanding_balance) / 500_000, 1)
      const score = Number(sigmoid(raw * 4 - 2).toFixed(4))
      return `(${r.customer_id}, '${score}', ${esc(riskBucket(score))}, ${r.outstanding_balance}, ${r.credit_utilization}, ${r.avg_days_overdue}, ${esc(r.payment_trend)})`
    }).join(',\n')
    await exec(`INSERT INTO credit_risk_scores (customer_id, risk_score, risk_level, outstanding_balance, credit_utilization, avg_days_overdue, payment_trend) VALUES ${vals}`)
    console.log(`   Scored ${creditFeatures.length} customers for credit risk`)
  } else {
    console.log('   No customer data')
  }

  // 5. Cash Flow Forecast
  console.log('5. Running cash flow forecast...')
  const history = await query(`
    WITH months AS (
      SELECT generate_series(
        date_trunc('month', CURRENT_DATE - interval '5 months'),
        date_trunc('month', CURRENT_DATE),
        '1 month'
      )::date AS month
    ),
    inflows AS (
      SELECT date_trunc('month', payment_date)::date AS month,
             COALESCE(SUM(amount::numeric), 0) AS total
      FROM incoming_payments_col
      WHERE status = 'CONFIRMED'
        AND payment_date >= CURRENT_DATE - interval '6 months'
      GROUP BY 1
    ),
    outflows AS (
      SELECT date_trunc('month', payment_date)::date AS month,
             COALESCE(SUM(amount::numeric), 0) AS total
      FROM outgoing_payments_col
      WHERE status IN ('COMPLETED','CONFIRMED')
        AND payment_date >= CURRENT_DATE - interval '6 months'
      GROUP BY 1
    )
    SELECT
      m.month::text,
      COALESCE(i.total, 0)::text AS total_inflow,
      COALESCE(o.total, 0)::text AS total_outflow
    FROM months m
    LEFT JOIN inflows  i ON i.month = m.month
    LEFT JOIN outflows o ON o.month = m.month
    ORDER BY m.month
  `)
  const avgInflow = history.reduce((s: number, r: any) => s + Number(r.total_inflow), 0) / Math.max(history.length, 1)
  const avgOutflow = history.reduce((s: number, r: any) => s + Number(r.total_outflow), 0) / Math.max(history.length, 1)

  await exec('DELETE FROM cash_flow_forecasts')
  const forecastVals = Array.from({ length: 6 }).map((_, i) => {
    const d = new Date()
    d.setMonth(d.getMonth() + i + 1, 1)
    const dateStr = d.toISOString().slice(0, 10)
    return `('${dateStr}', '${Math.round(avgInflow)}', '${Math.round(avgOutflow)}', '${Math.round(avgInflow * 0.8)}', '${Math.round(avgInflow * 1.2)}', '6 months')`
  }).join(',\n')
  await exec(`INSERT INTO cash_flow_forecasts (forecast_date, predicted_inflow, predicted_outflow, confidence_lower, confidence_upper, based_on_period) VALUES ${forecastVals}`)
  console.log(`   Generated 6-month forecast (avg inflow: ${Math.round(avgInflow)}, avg outflow: ${Math.round(avgOutflow)})`)

  console.log('\nAll ML pipeline tasks completed successfully!')
}

main().catch(e => { console.error(e); process.exit(1) })
