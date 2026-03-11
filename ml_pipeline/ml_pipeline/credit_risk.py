"""
Credit Risk Scoring for customers with outstanding balances.

Evaluates credit risk using features derived from the invoices and
incoming_payments tables: payment history, overdue patterns, credit utilization,
and payment trend. Uses a logistic regression (or rule-based fallback) approach
to produce a risk score. Results are written to the credit_risk_scores table.
"""

from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import StandardScaler
import pandas as pd
import numpy as np
from .db import get_connection, execute_query, upsert_credit_risk_scores
import psycopg2.extras


FEATURE_NAMES = [
    'avg_days_overdue',
    'max_days_overdue_last_90d',
    'payment_trend_slope',
    'credit_utilization',
    'invoice_frequency_change',
    'avg_payment_ratio_change',
    'account_age_days',
    'total_lifetime_payments',
]

RISK_FACTOR_LABELS = {
    'avg_days_overdue': 'Consistently late payments',
    'max_days_overdue_last_90d': 'Recent severe overdue event',
    'payment_trend_slope': 'Worsening payment behavior',
    'credit_utilization': 'High outstanding balance ratio',
    'invoice_frequency_change': 'Declining invoice activity',
    'avg_payment_ratio_change': 'Declining payment amounts',
    'account_age_days': 'New/unestablished account',
    'total_lifetime_payments': 'Low total payment volume',
}


def _fetch_credit_features():
    """
    Fetch credit risk features per customer from the customers, invoices,
    and incoming_payments tables.
    """
    query = """
        WITH payment_stats AS (
            SELECT
                i.customer_id,
                AVG(
                    GREATEST(
                        EXTRACT(EPOCH FROM (COALESCE(ip.payment_date, NOW())::timestamp
                                           - i.due_date::timestamp)) / 86400.0,
                        0
                    )
                ) AS avg_days_overdue,
                MAX(CASE
                    WHEN ip.payment_date::timestamp >= NOW() - INTERVAL '90 days'
                      OR (ip.payment_date IS NULL AND i.due_date::timestamp < NOW())
                    THEN GREATEST(
                        EXTRACT(EPOCH FROM (NOW() - i.due_date::timestamp)) / 86400.0, 0
                    )
                    ELSE 0
                END) AS max_days_overdue_last_90d,
                SUM(CAST(i.balance_remaining AS numeric)) AS total_outstanding,
                SUM(CAST(i.amount AS numeric))            AS total_invoiced
            FROM invoices_col i
            LEFT JOIN incoming_payments_col ip ON ip.invoice_id = i.invoice_id
            GROUP BY i.customer_id
        ),
        payment_trend AS (
            -- Slope: avg overdue days in recent 3 payments vs prior 3
            SELECT
                i.customer_id,
                COALESCE(
                    (
                        SELECT AVG(
                            GREATEST(
                                EXTRACT(EPOCH FROM (ip2.payment_date::timestamp
                                                   - i2.due_date::timestamp)) / 86400.0,
                                0
                            )
                        )
                        FROM (
                            SELECT ip3.payment_date, ip3.invoice_id
                            FROM incoming_payments_col ip3
                            JOIN invoices_col i3 ON ip3.invoice_id = i3.invoice_id
                            WHERE i3.customer_id = i.customer_id
                            ORDER BY ip3.payment_date DESC
                            LIMIT 3
                        ) sub
                        JOIN incoming_payments_col ip2 ON ip2.payment_date = sub.payment_date
                        JOIN invoices_col i2 ON ip2.invoice_id = sub.invoice_id
                    ) -
                    (
                        SELECT AVG(
                            GREATEST(
                                EXTRACT(EPOCH FROM (ip2.payment_date::timestamp
                                                   - i2.due_date::timestamp)) / 86400.0,
                                0
                            )
                        )
                        FROM (
                            SELECT ip3.payment_date, ip3.invoice_id
                            FROM incoming_payments_col ip3
                            JOIN invoices_col i3 ON ip3.invoice_id = i3.invoice_id
                            WHERE i3.customer_id = i.customer_id
                            ORDER BY ip3.payment_date DESC
                            LIMIT 6 OFFSET 3
                        ) sub
                        JOIN incoming_payments_col ip2 ON ip2.payment_date = sub.payment_date
                        JOIN invoices_col i2 ON ip2.invoice_id = sub.invoice_id
                    ),
                    0
                ) AS payment_trend_slope
            FROM invoices_col i
            GROUP BY i.customer_id
        ),
        activity_stats AS (
            SELECT
                i.customer_id,
                -- Invoice frequency change: recent 60d vs prior 60d
                CASE
                    WHEN COUNT(DISTINCT CASE
                        WHEN i.issue_date::timestamp >= NOW() - INTERVAL '120 days'
                         AND i.issue_date::timestamp < NOW() - INTERVAL '60 days'
                        THEN i.invoice_id END) > 0
                    THEN (
                        COUNT(DISTINCT CASE
                            WHEN i.issue_date::timestamp >= NOW() - INTERVAL '60 days'
                            THEN i.invoice_id END)::float
                        / NULLIF(COUNT(DISTINCT CASE
                            WHEN i.issue_date::timestamp >= NOW() - INTERVAL '120 days'
                             AND i.issue_date::timestamp < NOW() - INTERVAL '60 days'
                            THEN i.invoice_id END)::float, 1)
                    ) - 1.0
                    ELSE 0
                END AS invoice_frequency_change,
                -- Avg payment ratio change (recent vs prior)
                CASE
                    WHEN AVG(CASE
                        WHEN ip.payment_date::timestamp >= NOW() - INTERVAL '120 days'
                         AND ip.payment_date::timestamp < NOW() - INTERVAL '60 days'
                        THEN CAST(ip.amount AS numeric) /
                             NULLIF(CAST(i.amount AS numeric), 0)
                        END) > 0
                    THEN (
                        AVG(CASE
                            WHEN ip.payment_date::timestamp >= NOW() - INTERVAL '60 days'
                            THEN CAST(ip.amount AS numeric) /
                                 NULLIF(CAST(i.amount AS numeric), 0)
                            END)
                        / NULLIF(AVG(CASE
                            WHEN ip.payment_date::timestamp >= NOW() - INTERVAL '120 days'
                             AND ip.payment_date::timestamp < NOW() - INTERVAL '60 days'
                            THEN CAST(ip.amount AS numeric) /
                                 NULLIF(CAST(i.amount AS numeric), 0)
                            END), 1)
                    ) - 1.0
                    ELSE 0
                END AS avg_payment_ratio_change,
                SUM(CAST(ip.amount AS numeric)) AS total_lifetime_payments
            FROM invoices_col i
            LEFT JOIN incoming_payments_col ip ON ip.invoice_id = i.invoice_id
            GROUP BY i.customer_id
        )
        SELECT
            c.customer_id,
            COALESCE(ps.avg_days_overdue, 0)           AS avg_days_overdue,
            COALESCE(ps.max_days_overdue_last_90d, 0)  AS max_days_overdue_last_90d,
            COALESCE(pt.payment_trend_slope, 0)        AS payment_trend_slope,
            -- Credit utilization = outstanding / total invoiced
            CASE
                WHEN COALESCE(ps.total_invoiced, 0) > 0
                THEN COALESCE(ps.total_outstanding, 0) / ps.total_invoiced
                ELSE 0
            END AS credit_utilization,
            COALESCE(ast.invoice_frequency_change, 0)  AS invoice_frequency_change,
            COALESCE(ast.avg_payment_ratio_change, 0)  AS avg_payment_ratio_change,
            EXTRACT(EPOCH FROM (NOW() - c.created_at::timestamp)) / 86400.0
                AS account_age_days,
            COALESCE(ast.total_lifetime_payments, 0)   AS total_lifetime_payments,
            COALESCE(ps.total_outstanding, 0)          AS outstanding_balance,
            COALESCE(ps.total_invoiced, 0)             AS total_invoiced
        FROM customers_col c
        LEFT JOIN payment_stats ps  ON c.customer_id = ps.customer_id
        LEFT JOIN payment_trend pt  ON c.customer_id = pt.customer_id
        LEFT JOIN activity_stats ast ON c.customer_id = ast.customer_id
        WHERE c.status = 'active'
    """
    rows = execute_query(query)
    if not rows:
        return pd.DataFrame()

    df = pd.DataFrame(rows)
    for col in FEATURE_NAMES + ['outstanding_balance', 'total_invoiced']:
        df[col] = pd.to_numeric(df[col], errors='coerce').fillna(0)

    return df


def _determine_risk_level(score):
    """Map risk score to risk level string."""
    if score < 0.25:
        return 'low'
    elif score < 0.50:
        return 'medium'
    elif score < 0.75:
        return 'high'
    else:
        return 'critical'


def _determine_payment_trend(slope):
    """Determine payment trend label from slope value."""
    if slope < -0.5:
        return 'improving'
    elif slope > 0.5:
        return 'deteriorating'
    else:
        return 'stable'


def _top_risk_factor(features_row, coefficients):
    """Determine the top risk factor for a customer using coefficient weights."""
    weighted = np.abs(features_row * coefficients)
    top_idx = np.argmax(weighted)
    return RISK_FACTOR_LABELS.get(FEATURE_NAMES[top_idx], FEATURE_NAMES[top_idx])


def run_credit_risk_scoring(params):
    """
    Run credit risk scoring for all active customers.

    Uses logistic regression with synthetic labels when enough data is available;
    falls back to a rule-based weighted formula otherwise.

    Args:
        params: dict (reserved for future use)

    Returns:
        dict with 'summary' describing results and risk distribution
    """
    try:
        df = _fetch_credit_features()

        if df.empty or len(df) < 5:
            return {
                'summary': 'Not enough customer data for credit risk scoring',
            }

        X = df[FEATURE_NAMES].values

        # Synthetic risk labels: high risk if overdue > 15d, max overdue > 30d,
        # or credit utilization > 0.8
        y_synthetic = (
            (df['avg_days_overdue'] > 15).astype(int) |
            (df['max_days_overdue_last_90d'] > 30).astype(int) |
            (df['credit_utilization'] > 0.8).astype(int)
        ).values

        scaler = StandardScaler()
        X_scaled = scaler.fit_transform(X)

        unique_labels = np.unique(y_synthetic)
        if len(unique_labels) >= 2 and len(df) >= 10:
            model = LogisticRegression(
                random_state=42,
                max_iter=1000,
                class_weight='balanced',
            )
            model.fit(X_scaled, y_synthetic)
            risk_scores = model.predict_proba(X_scaled)[:, 1]
            coefficients = model.coef_[0]

            df['top_risk_factor'] = df.apply(
                lambda row: _top_risk_factor(
                    row[FEATURE_NAMES].values.astype(float), coefficients
                ),
                axis=1,
            )
        else:
            # Rule-based fallback
            risk_scores = (
                0.30 * np.clip(df['avg_days_overdue'].values / 60.0, 0, 1) +
                0.25 * np.clip(df['max_days_overdue_last_90d'].values / 90.0, 0, 1) +
                0.25 * np.clip(df['credit_utilization'].values, 0, 1) +
                0.10 * np.clip(-df['invoice_frequency_change'].values, 0, 1) +
                0.10 * np.clip(df['payment_trend_slope'].values / 10.0, 0, 1)
            )
            risk_scores = np.clip(risk_scores, 0, 1)

            factor_scores = pd.DataFrame({
                'avg_days_overdue': np.clip(df['avg_days_overdue'].values / 60.0, 0, 1) * 0.30,
                'max_days_overdue_last_90d': np.clip(df['max_days_overdue_last_90d'].values / 90.0, 0, 1) * 0.25,
                'credit_utilization': np.clip(df['credit_utilization'].values, 0, 1) * 0.25,
                'invoice_frequency_change': np.clip(-df['invoice_frequency_change'].values, 0, 1) * 0.10,
                'payment_trend_slope': np.clip(df['payment_trend_slope'].values / 10.0, 0, 1) * 0.10,
            })
            top_factors = factor_scores.idxmax(axis=1)
            df['top_risk_factor'] = top_factors.map(RISK_FACTOR_LABELS).fillna('General risk')

        df['risk_score'] = risk_scores
        df['risk_level'] = df['risk_score'].apply(_determine_risk_level)
        df['payment_trend'] = df['payment_trend_slope'].apply(_determine_payment_trend)

        rows = [
            (
                row['customer_id'],
                float(row['risk_score']),
                row['risk_level'],
                float(row['outstanding_balance']),
                float(row['credit_utilization']),
                float(row['avg_days_overdue']),
                row['payment_trend'],
                row['top_risk_factor'],
            )
            for _, row in df.iterrows()
        ]
        upsert_credit_risk_scores(rows)

        risk_distribution = df['risk_level'].value_counts().to_dict()
        dist_str = ", ".join(f"{k}: {v}" for k, v in risk_distribution.items())

        return {
            'summary': (
                f"Scored {len(df)} customers for credit risk. "
                f"Risk distribution: {dist_str}"
            ),
            'customer_count': len(df),
            'risk_distribution': risk_distribution,
        }

    except Exception as e:
        return {
            'summary': f"Credit risk scoring failed: {str(e)}",
            'error': str(e),
        }
