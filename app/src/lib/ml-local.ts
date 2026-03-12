/**
 * Local ML pipeline – TypeScript re-implementation of the Python Lambda
 * pipeline so demo / dev environments can populate ML output tables
 * without requiring AWS Lambda.
 *
 * Tasks mirror the Python lambda_handler.py:
 *   payment_patterns    → runPaymentPatterns
 *   payer_segmentation  → runPayerSegmentation
 *   delinquency_scoring → runDelinquencyScoring
 *   credit_risk         → runCreditRiskScoring
 *   cash_flow_forecast  → runCashFlowForecast
 */

import { db } from '@/db'
import { sql } from 'drizzle-orm'
import {
  payerSegments,
  delinquencyScores,
  creditRiskScores,
  paymentPatterns,
  cashFlowForecasts,
} from '@/db/schema'

// ────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────

/** Logistic sigmoid normalisation into [0,1] */
function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x))
}

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

// ────────────────────────────────────────────────────────────
// 1. Payment Patterns
// ────────────────────────────────────────────────────────────

async function runPaymentPatterns(): Promise<string> {
  const rows = await db.execute<{
    customer_id: number
    avg_days_to_pay: string | null
    preferred_method: string | null
    typical_payment_day: number | null
    partial_payment_rate: string | null
  }>(sql`
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

  if (rows.length === 0) return 'No payment data to analyse'

  // Clear old patterns
  await db.delete(paymentPatterns)

  // Insert new
  await db.insert(paymentPatterns).values(
    rows.map((r) => ({
      customerId: r.customer_id,
      avgDaysToPay: r.avg_days_to_pay ?? '0',
      preferredMethod: r.preferred_method ?? 'UNKNOWN',
      typicalPaymentDay: r.typical_payment_day ?? 1,
      partialPaymentRate: r.partial_payment_rate ?? '0',
    }))
  )

  return `Computed payment patterns for ${rows.length} customers`
}

// ────────────────────────────────────────────────────────────
// 2. Payer Segmentation
// ────────────────────────────────────────────────────────────

async function runPayerSegmentation(): Promise<string> {
  const rows = await db.execute<{
    customer_id: number
    payment_count: number
    regularity_score: string
    amount_score: string
    timeliness_score: string
  }>(sql`
    WITH cust_payments AS (
      SELECT
        c.customer_id,
        COUNT(p.payment_id) AS payment_count,
        -- Regularity: inverse std-dev of inter-payment intervals (normalised 0-1)
        CASE
          WHEN COUNT(p.payment_id) < 2 THEN 0
          ELSE GREATEST(0, LEAST(1,
            1 - (STDDEV(EXTRACT(EPOCH FROM (p.payment_date - LAG(p.payment_date)
                  OVER (PARTITION BY p.customer_id ORDER BY p.payment_date)))) / 86400
                 / NULLIF(AVG(EXTRACT(EPOCH FROM (p.payment_date - LAG(p.payment_date)
                   OVER (PARTITION BY p.customer_id ORDER BY p.payment_date)))) / 86400, 0))
          ))
        END::numeric(5,2) AS regularity_score,
        -- Amount score: avg payment / avg invoice
        CASE
          WHEN COUNT(p.payment_id) = 0 THEN 0
          ELSE GREATEST(0, LEAST(1,
            AVG(p.amount::numeric) / NULLIF(AVG(i.amount::numeric), 0)
          ))
        END::numeric(5,2) AS amount_score,
        -- Timeliness: normalised avg days-to-pay (lower is better)
        CASE
          WHEN COUNT(p.payment_id) = 0 THEN 0
          ELSE GREATEST(0, LEAST(1,
            1 - LEAST(AVG(EXTRACT(EPOCH FROM (p.payment_date - i.issued_at)) / 86400), 60) / 60
          ))
        END::numeric(5,2) AS timeliness_score
      FROM customers_col c
      LEFT JOIN invoices_col i  ON i.customer_id = c.customer_id
      LEFT JOIN incoming_payments_col p ON p.invoice_id = i.invoice_id
      GROUP BY c.customer_id
    )
    SELECT * FROM cust_payments
  `)

  if (rows.length === 0) return 'No customers found'

  await db.delete(payerSegments)

  await db.insert(payerSegments).values(
    rows.map((r, idx) => {
      const composite =
        (Number(r.regularity_score) + Number(r.amount_score) + Number(r.timeliness_score)) / 3
      return {
        customerId: r.customer_id,
        segmentName: segmentLabel(composite, r.payment_count),
        regularityScore: r.regularity_score,
        amountScore: r.amount_score,
        timelinessScore: r.timeliness_score,
        clusterId: composite >= 0.75 ? 0 : composite >= 0.5 ? 1 : composite >= 0.3 ? 2 : 3,
      }
    })
  )

  return `Segmented ${rows.length} customers`
}

// ────────────────────────────────────────────────────────────
// 3. Delinquency Scoring
// ────────────────────────────────────────────────────────────

async function runDelinquencyScoring(): Promise<string> {
  const rows = await db.execute<{
    customer_id: number
    days_overdue_avg: string
    missed_payments: number
    payment_trend: string
    balance_ratio: string
  }>(sql`
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

  if (rows.length === 0) return 'No customer data'

  await db.delete(delinquencyScores)

  await db.insert(delinquencyScores).values(
    rows.map((r) => {
      // Weighted score (mirrors Python churn_scoring.py)
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

      return {
        customerId: r.customer_id,
        riskScore: String(score),
        riskLevel: level,
        daysOverdueAvg: r.days_overdue_avg,
        missedPayments: r.missed_payments,
        paymentTrend: r.payment_trend,
        topRiskFactor: topFactor,
      }
    })
  )

  return `Scored ${rows.length} customers for delinquency risk`
}

// ────────────────────────────────────────────────────────────
// 4. Credit Risk Scoring
// ────────────────────────────────────────────────────────────

async function runCreditRiskScoring(): Promise<string> {
  const rows = await db.execute<{
    customer_id: number
    outstanding_balance: string
    credit_utilization: string
    avg_days_overdue: string
    payment_trend: string
  }>(sql`
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

  if (rows.length === 0) return 'No customer data'

  await db.delete(creditRiskScores)

  await db.insert(creditRiskScores).values(
    rows.map((r) => {
      const raw =
        0.30 * Math.min(Number(r.credit_utilization), 1) +
        0.30 * Math.min(Number(r.avg_days_overdue) / 90, 1) +
        0.20 * (r.payment_trend === 'declining' ? 1 : r.payment_trend === 'stable' ? 0.3 : 0) +
        0.20 * Math.min(Number(r.outstanding_balance) / 500_000, 1)
      const score = Number(sigmoid(raw * 4 - 2).toFixed(4))

      return {
        customerId: r.customer_id,
        riskScore: String(score),
        riskLevel: riskBucket(score),
        outstandingBalance: r.outstanding_balance,
        creditUtilization: r.credit_utilization,
        avgDaysOverdue: r.avg_days_overdue,
        paymentTrend: r.payment_trend,
      }
    })
  )

  return `Scored ${rows.length} customers for credit risk`
}

// ────────────────────────────────────────────────────────────
// 5. Cash Flow Forecast
// ────────────────────────────────────────────────────────────

async function runCashFlowForecast(): Promise<string> {
  // Gather monthly totals for last 6 months
  const history = await db.execute<{
    month: string
    total_inflow: string
    total_outflow: string
  }>(sql`
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

  const avgInflow =
    history.reduce((s, r) => s + Number(r.total_inflow), 0) / Math.max(history.length, 1)
  const avgOutflow =
    history.reduce((s, r) => s + Number(r.total_outflow), 0) / Math.max(history.length, 1)

  // Project 6 months forward
  await db.delete(cashFlowForecasts)

  const forecasts = Array.from({ length: 6 }).map((_, i) => {
    const d = new Date()
    d.setMonth(d.getMonth() + i + 1, 1)
    const dateStr = d.toISOString().slice(0, 10)
    return {
      forecastDate: dateStr,
      predictedInflow: String(Math.round(avgInflow)),
      predictedOutflow: String(Math.round(avgOutflow)),
      confidenceLower: String(Math.round(avgInflow * 0.8)),
      confidenceUpper: String(Math.round(avgInflow * 1.2)),
      basedOnPeriod: '6 months',
    }
  })

  if (forecasts.length > 0) {
    await db.insert(cashFlowForecasts).values(forecasts)
  }

  return `Generated 6-month cash flow forecast (avg inflow: ${Math.round(avgInflow)}, avg outflow: ${Math.round(avgOutflow)})`
}

// ────────────────────────────────────────────────────────────
// Public orchestrator
// ────────────────────────────────────────────────────────────

const TASK_MAP: Record<string, () => Promise<string>> = {
  payment_patterns: runPaymentPatterns,
  payer_segmentation: runPayerSegmentation,
  delinquency_scoring: runDelinquencyScoring,
  credit_risk: runCreditRiskScoring,
  cash_flow_forecast: runCashFlowForecast,
}

export const ALL_TASKS = Object.keys(TASK_MAP)

export async function runLocalPipeline(
  tasks: string[]
): Promise<{ tasks_completed: string[]; summary: Record<string, string> }> {
  const completed: string[] = []
  const summary: Record<string, string> = {}

  for (const task of tasks) {
    const fn = TASK_MAP[task]
    if (!fn) continue
    try {
      summary[task] = await fn()
      completed.push(task)
    } catch (err) {
      summary[task] = `Error: ${err instanceof Error ? err.message : String(err)}`
    }
  }

  return { tasks_completed: completed, summary }
}
