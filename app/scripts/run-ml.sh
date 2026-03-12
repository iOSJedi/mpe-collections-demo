#!/bin/bash
set -euo pipefail

# Load env
set -a
source .env.local
set +a

PROXY_URL="$SUPABASE_SQL_PROXY_URL"
PROXY_KEY="$SUPABASE_SQL_PROXY_KEY"

run_sql() {
  local sql_text="$1"
  local result
  result=$(curl -s --max-time 30 "$PROXY_URL" \
    -X POST \
    -H "Content-Type: application/json" \
    -H "x-api-key: $PROXY_KEY" \
    -d "{\"sql\": $(echo "$sql_text" | jq -Rs .), \"params\": [], \"method\": \"execute\"}")
  echo "$result"
}

echo "Testing connectivity..."
CNT=$(run_sql "SELECT COUNT(*)::int AS cnt FROM customers_col" | jq -r '.rows[0].cnt')
echo "Connected. Found $CNT customers."

# 1. Payment Patterns
echo ""
echo "1. Running payment patterns..."
run_sql "
DELETE FROM payment_patterns;
INSERT INTO payment_patterns (customer_id, avg_days_to_pay, preferred_method, typical_payment_day, partial_payment_rate)
SELECT
  p.customer_id,
  AVG(EXTRACT(EPOCH FROM (p.payment_date - i.issued_at)) / 86400)::numeric(6,1),
  MODE() WITHIN GROUP (ORDER BY p.payment_method),
  MODE() WITHIN GROUP (ORDER BY EXTRACT(DAY FROM p.payment_date)::int),
  ROUND(COUNT(*) FILTER (WHERE p.amount::numeric < i.amount::numeric)::numeric / NULLIF(COUNT(*), 0), 2)
FROM incoming_payments_col p
JOIN invoices_col i ON i.invoice_id = p.invoice_id
GROUP BY p.customer_id
" > /dev/null
echo "   Done"

# 2. Payer Segmentation
echo "2. Running payer segmentation..."
run_sql "
DELETE FROM payer_segments;
INSERT INTO payer_segments (customer_id, segment_name, regularity_score, amount_score, timeliness_score, cluster_id)
WITH cust AS (
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
      ELSE GREATEST(0, LEAST(1, AVG(p.amount::numeric) / NULLIF(AVG(i.amount::numeric), 0)))
    END::numeric(5,2) AS amount_score,
    CASE
      WHEN COUNT(p.payment_id) = 0 THEN 0
      ELSE GREATEST(0, LEAST(1, 1 - LEAST(AVG(EXTRACT(EPOCH FROM (p.payment_date - i.issued_at)) / 86400), 60) / 60))
    END::numeric(5,2) AS timeliness_score
  FROM customers_col c
  LEFT JOIN invoices_col i ON i.customer_id = c.customer_id
  LEFT JOIN incoming_payments_col p ON p.invoice_id = i.invoice_id
  GROUP BY c.customer_id
)
SELECT
  customer_id,
  CASE
    WHEN payment_count = 0 THEN 'New Customer'
    WHEN (regularity_score + amount_score + timeliness_score) / 3 >= 0.75 THEN 'Reliable Payer'
    WHEN (regularity_score + amount_score + timeliness_score) / 3 >= 0.5 THEN 'Occasional Late'
    WHEN (regularity_score + amount_score + timeliness_score) / 3 >= 0.3 THEN 'Partial Payer'
    ELSE 'Chronic Delinquent'
  END,
  regularity_score,
  amount_score,
  timeliness_score,
  CASE
    WHEN (regularity_score + amount_score + timeliness_score) / 3 >= 0.75 THEN 0
    WHEN (regularity_score + amount_score + timeliness_score) / 3 >= 0.5 THEN 1
    WHEN (regularity_score + amount_score + timeliness_score) / 3 >= 0.3 THEN 2
    ELSE 3
  END
FROM cust
" > /dev/null
echo "   Done"

# 3. Delinquency Scoring
echo "3. Running delinquency scoring..."
run_sql "
DELETE FROM delinquency_scores;
INSERT INTO delinquency_scores (customer_id, risk_score, risk_level, days_overdue_avg, missed_payments, payment_trend, top_risk_factor)
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
),
scored AS (
  SELECT *,
    (1.0 / (1.0 + EXP(-(
      (0.35 * LEAST(days_overdue_avg / 90, 1) +
       0.25 * LEAST(missed_payments::numeric / 6, 1) +
       0.20 * CASE WHEN payment_trend = 'declining' THEN 1 WHEN payment_trend = 'stable' THEN 0.3 ELSE 0 END +
       0.20 * LEAST(balance_ratio, 1)
      ) * 4 - 2
    ))))::numeric(5,4) AS risk_score
  FROM features
)
SELECT
  customer_id,
  risk_score::text,
  CASE
    WHEN risk_score >= 0.75 THEN 'CRITICAL'
    WHEN risk_score >= 0.5 THEN 'HIGH'
    WHEN risk_score >= 0.25 THEN 'MEDIUM'
    ELSE 'LOW'
  END,
  days_overdue_avg,
  missed_payments,
  payment_trend,
  CASE
    WHEN GREATEST(days_overdue_avg / 90, missed_payments::numeric / 6,
                  CASE WHEN payment_trend = 'declining' THEN 1 ELSE 0 END,
                  balance_ratio) = days_overdue_avg / 90 THEN 'High overdue days'
    WHEN GREATEST(days_overdue_avg / 90, missed_payments::numeric / 6,
                  CASE WHEN payment_trend = 'declining' THEN 1 ELSE 0 END,
                  balance_ratio) = missed_payments::numeric / 6 THEN 'Frequent missed payments'
    WHEN GREATEST(days_overdue_avg / 90, missed_payments::numeric / 6,
                  CASE WHEN payment_trend = 'declining' THEN 1 ELSE 0 END,
                  balance_ratio) = CASE WHEN payment_trend = 'declining' THEN 1 ELSE 0 END THEN 'Declining payment trend'
    ELSE 'High balance ratio'
  END
FROM scored
" > /dev/null
echo "   Done"

# 4. Credit Risk Scoring
echo "4. Running credit risk scoring..."
run_sql "
DELETE FROM credit_risk_scores;
INSERT INTO credit_risk_scores (customer_id, risk_score, risk_level, outstanding_balance, credit_utilization, avg_days_overdue, payment_trend)
WITH features AS (
  SELECT
    c.customer_id,
    COALESCE(SUM(i.balance_remaining::numeric), 0)::numeric(12,2) AS outstanding_balance,
    CASE
      WHEN COALESCE(SUM(i.amount::numeric), 0) = 0 THEN 0
      ELSE ROUND(COALESCE(SUM(i.balance_remaining::numeric), 0) / NULLIF(SUM(i.amount::numeric), 0), 2)
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
),
scored AS (
  SELECT *,
    (1.0 / (1.0 + EXP(-(
      (0.30 * LEAST(credit_utilization, 1) +
       0.30 * LEAST(avg_days_overdue / 90, 1) +
       0.20 * CASE WHEN payment_trend = 'declining' THEN 1 WHEN payment_trend = 'stable' THEN 0.3 ELSE 0 END +
       0.20 * LEAST(outstanding_balance / 500000, 1)
      ) * 4 - 2
    ))))::numeric(5,4) AS risk_score
  FROM features
)
SELECT
  customer_id,
  risk_score::text,
  CASE
    WHEN risk_score >= 0.75 THEN 'CRITICAL'
    WHEN risk_score >= 0.5 THEN 'HIGH'
    WHEN risk_score >= 0.25 THEN 'MEDIUM'
    ELSE 'LOW'
  END,
  outstanding_balance,
  credit_utilization,
  avg_days_overdue,
  payment_trend
FROM scored
" > /dev/null
echo "   Done"

# 5. Cash Flow Forecast
echo "5. Running cash flow forecast..."
run_sql "
DELETE FROM cash_flow_forecasts;
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
  WHERE status = 'CONFIRMED' AND payment_date >= CURRENT_DATE - interval '6 months'
  GROUP BY 1
),
outflows AS (
  SELECT date_trunc('month', payment_date)::date AS month,
         COALESCE(SUM(amount::numeric), 0) AS total
  FROM outgoing_payments_col
  WHERE status IN ('COMPLETED','CONFIRMED') AND payment_date >= CURRENT_DATE - interval '6 months'
  GROUP BY 1
),
averages AS (
  SELECT
    COALESCE(AVG(COALESCE(i.total, 0)), 0)::numeric(12,0) AS avg_inflow,
    COALESCE(AVG(COALESCE(o.total, 0)), 0)::numeric(12,0) AS avg_outflow
  FROM months m
  LEFT JOIN inflows i ON i.month = m.month
  LEFT JOIN outflows o ON o.month = m.month
),
future_months AS (
  SELECT generate_series(
    date_trunc('month', CURRENT_DATE + interval '1 month'),
    date_trunc('month', CURRENT_DATE + interval '6 months'),
    '1 month'
  )::date AS forecast_date
)
INSERT INTO cash_flow_forecasts (forecast_date, predicted_inflow, predicted_outflow, confidence_lower, confidence_upper, based_on_period)
SELECT
  f.forecast_date,
  a.avg_inflow::text,
  a.avg_outflow::text,
  (a.avg_inflow * 0.8)::numeric(12,0)::text,
  (a.avg_inflow * 1.2)::numeric(12,0)::text,
  '6 months'
FROM future_months f, averages a
" > /dev/null
echo "   Done"

echo ""
echo "All ML pipeline tasks completed successfully!"
