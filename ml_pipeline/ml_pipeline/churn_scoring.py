"""
Delinquency Scoring for AR customers.

Computes a 0-1 delinquency score per customer using four features:
  - avg_days_overdue: average days past due date across all invoices
  - missed_payment_count: invoices still in OVERDUE status
  - payment_trend: 'declining' | 'stable' | 'improving' (last 3 months vs prior)
  - outstanding_balance_ratio: total balance_remaining / total invoice amount

Score is produced by a logistic-like weighted formula. Customers are bucketed:
  LOW (0–0.25), MEDIUM (0.25–0.5), HIGH (0.5–0.75), CRITICAL (0.75–1.0).

Results are written to the delinquency_scores table.
"""

import pandas as pd
import numpy as np
from .db import execute_query, upsert_delinquency_scores


# Feature weights for the delinquency score formula (must sum to 1.0)
FEATURE_WEIGHTS = {
    'avg_days_overdue_norm': 0.35,
    'missed_payment_norm': 0.25,
    'trend_score': 0.20,
    'balance_ratio': 0.20,
}

RISK_FACTOR_LABELS = {
    'avg_days_overdue_norm': 'Consistently late payments',
    'missed_payment_norm': 'Multiple overdue invoices',
    'trend_score': 'Worsening payment trend',
    'balance_ratio': 'High outstanding balance ratio',
}


def _fetch_delinquency_features():
    """
    Fetch per-customer features for delinquency scoring from invoices and
    incoming_payments tables.
    """
    query = """
        WITH invoice_stats AS (
            SELECT
                i.customer_id,
                -- Average days overdue (days past due_date, 0 if not overdue)
                AVG(
                    GREATEST(
                        EXTRACT(EPOCH FROM (NOW() - i.due_date::timestamp)) / 86400.0,
                        0
                    )
                ) AS avg_days_overdue,
                -- Number of invoices still in OVERDUE status
                COUNT(*) FILTER (WHERE i.status = 'OVERDUE') AS missed_payment_count,
                -- Total balance remaining
                SUM(CAST(i.balance_remaining AS numeric)) AS total_balance_remaining,
                -- Total invoice amount
                SUM(CAST(i.amount AS numeric)) AS total_invoice_amount
            FROM invoices_col i
            WHERE i.customer_id IS NOT NULL
            GROUP BY i.customer_id
        ),
        recent_payments AS (
            -- Payments in the last 3 months
            SELECT
                i.customer_id,
                COUNT(ip.payment_id) AS payments_recent
            FROM incoming_payments_col ip
            JOIN invoices_col i ON ip.invoice_id = i.invoice_id
            WHERE ip.payment_date >= NOW() - INTERVAL '3 months'
            GROUP BY i.customer_id
        ),
        prior_payments AS (
            -- Payments in the 3 months before that (months 3-6 ago)
            SELECT
                i.customer_id,
                COUNT(ip.payment_id) AS payments_prior
            FROM incoming_payments_col ip
            JOIN invoices_col i ON ip.invoice_id = i.invoice_id
            WHERE ip.payment_date >= NOW() - INTERVAL '6 months'
              AND ip.payment_date < NOW() - INTERVAL '3 months'
            GROUP BY i.customer_id
        )
        SELECT
            c.customer_id,
            COALESCE(s.avg_days_overdue, 0)            AS avg_days_overdue,
            COALESCE(s.missed_payment_count, 0)        AS missed_payment_count,
            COALESCE(s.total_balance_remaining, 0)     AS total_balance_remaining,
            COALESCE(s.total_invoice_amount, 0)        AS total_invoice_amount,
            COALESCE(rp.payments_recent, 0)            AS payments_recent,
            COALESCE(pp.payments_prior, 0)             AS payments_prior
        FROM customers_col c
        LEFT JOIN invoice_stats s ON c.customer_id = s.customer_id
        LEFT JOIN recent_payments rp ON c.customer_id = rp.customer_id
        LEFT JOIN prior_payments pp ON c.customer_id = pp.customer_id
        WHERE c.status = 'active'
    """
    rows = execute_query(query)
    if not rows:
        return pd.DataFrame()

    df = pd.DataFrame(rows)
    numeric_cols = [
        'avg_days_overdue', 'missed_payment_count', 'total_balance_remaining',
        'total_invoice_amount', 'payments_recent', 'payments_prior',
    ]
    for col in numeric_cols:
        df[col] = pd.to_numeric(df[col], errors='coerce').fillna(0)

    return df


def _compute_payment_trend(row):
    """
    Determine payment trend based on payment counts in the last vs prior 3 months.
    Returns 'improving', 'stable', or 'declining'.
    """
    recent = row['payments_recent']
    prior = row['payments_prior']

    if prior == 0 and recent == 0:
        return 'stable'
    if prior == 0:
        return 'improving'

    ratio = recent / prior
    if ratio >= 1.2:
        return 'improving'
    elif ratio <= 0.8:
        return 'declining'
    else:
        return 'stable'


def _trend_to_score(trend):
    """Map trend label to a numeric contribution (higher = worse)."""
    return {'declining': 1.0, 'stable': 0.5, 'improving': 0.0}.get(trend, 0.5)


def _logistic(x):
    """Squash a raw weighted sum through a logistic function."""
    return 1.0 / (1.0 + np.exp(-6.0 * (x - 0.5)))


def _risk_bucket(score):
    """Map 0-1 score to LOW / MEDIUM / HIGH / CRITICAL bucket."""
    if score < 0.25:
        return 'LOW'
    elif score < 0.50:
        return 'MEDIUM'
    elif score < 0.75:
        return 'HIGH'
    else:
        return 'CRITICAL'


def run_churn_scoring(params):
    """
    Run delinquency scoring for all active customers.

    Args:
        params: dict (reserved for future use)

    Returns:
        dict with 'summary' describing results and risk distribution
    """
    try:
        df = _fetch_delinquency_features()

        if df.empty:
            return {'summary': 'No customer data found for delinquency scoring'}

        # --- Normalize features ---
        # avg_days_overdue: cap at 90 days
        df['avg_days_overdue_norm'] = np.clip(df['avg_days_overdue'] / 90.0, 0.0, 1.0)

        # missed_payment_count: cap at 10 invoices
        df['missed_payment_norm'] = np.clip(df['missed_payment_count'] / 10.0, 0.0, 1.0)

        # payment_trend
        df['payment_trend'] = df.apply(_compute_payment_trend, axis=1)
        df['trend_score'] = df['payment_trend'].apply(_trend_to_score)

        # outstanding_balance_ratio
        df['balance_ratio'] = np.where(
            df['total_invoice_amount'] > 0,
            np.clip(df['total_balance_remaining'] / df['total_invoice_amount'], 0.0, 1.0),
            0.0
        )

        # --- Compute weighted delinquency score ---
        raw_score = (
            FEATURE_WEIGHTS['avg_days_overdue_norm'] * df['avg_days_overdue_norm'] +
            FEATURE_WEIGHTS['missed_payment_norm'] * df['missed_payment_norm'] +
            FEATURE_WEIGHTS['trend_score'] * df['trend_score'] +
            FEATURE_WEIGHTS['balance_ratio'] * df['balance_ratio']
        )
        df['score'] = raw_score.apply(_logistic)
        df['risk_bucket'] = df['score'].apply(_risk_bucket)

        # --- Identify top risk factor per customer ---
        factor_df = pd.DataFrame({
            'avg_days_overdue_norm': df['avg_days_overdue_norm'] * FEATURE_WEIGHTS['avg_days_overdue_norm'],
            'missed_payment_norm': df['missed_payment_norm'] * FEATURE_WEIGHTS['missed_payment_norm'],
            'trend_score': df['trend_score'] * FEATURE_WEIGHTS['trend_score'],
            'balance_ratio': df['balance_ratio'] * FEATURE_WEIGHTS['balance_ratio'],
        })
        df['top_risk_factor'] = factor_df.idxmax(axis=1).map(RISK_FACTOR_LABELS)

        # --- Write to database ---
        rows = [
            (
                row['customer_id'],
                float(row['score']),
                row['risk_bucket'],
                float(row['avg_days_overdue']),
                int(row['missed_payment_count']),
                row['payment_trend'],
                float(row['balance_ratio']),
                row['top_risk_factor'],
            )
            for _, row in df.iterrows()
        ]
        upsert_delinquency_scores(rows)

        risk_distribution = df['risk_bucket'].value_counts().to_dict()
        dist_str = ", ".join(f"{k}: {v}" for k, v in risk_distribution.items())

        return {
            'summary': (
                f"Scored {len(df)} customers for delinquency risk. "
                f"Risk distribution: {dist_str}"
            ),
            'customer_count': len(df),
            'risk_distribution': risk_distribution,
        }

    except Exception as e:
        return {
            'summary': f"Delinquency scoring failed: {str(e)}",
            'error': str(e),
        }
