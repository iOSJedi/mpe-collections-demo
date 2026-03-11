"""
Credit Risk Scoring for wholesale customers.

Evaluates credit risk for wholesale customers with credit lines using features
like payment history, overdue patterns, credit utilization, and behavioral trends.
Uses Logistic Regression to produce a risk score, then maps to risk levels.
"""

from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import StandardScaler
import pandas as pd
import numpy as np
from .db import get_connection, execute_query
import psycopg2.extras


FEATURE_NAMES = [
    'avg_days_overdue',
    'max_days_overdue_last_90d',
    'payment_trend_slope',
    'credit_utilization',
    'order_frequency_change',
    'basket_size_change',
    'account_age_days',
    'total_lifetime_spend',
]

RISK_FACTOR_LABELS = {
    'avg_days_overdue': 'Consistently late payments',
    'max_days_overdue_last_90d': 'Recent severe overdue event',
    'payment_trend_slope': 'Worsening payment behavior',
    'credit_utilization': 'High credit utilization',
    'order_frequency_change': 'Declining order frequency',
    'basket_size_change': 'Declining order value',
    'account_age_days': 'New/unestablished account',
    'total_lifetime_spend': 'Low total business volume',
}


def _fetch_credit_features():
    """
    Fetch features for all wholesale customers with credit lines.
    Combines payment history, transaction behavior, and account info.
    """
    query = """
        WITH payment_stats AS (
            SELECT
                wp.customer_id,
                AVG(wp.days_overdue) AS avg_days_overdue,
                MAX(CASE
                    WHEN wp.payment_date::timestamp >= NOW() - INTERVAL '90 days'
                    THEN wp.days_overdue ELSE 0
                END) AS max_days_overdue_last_90d,
                -- Latest outstanding balance
                (SELECT wp2.outstanding_balance
                 FROM wholesale_payments wp2
                 WHERE wp2.customer_id = wp.customer_id
                 ORDER BY wp2.payment_date DESC LIMIT 1
                ) AS latest_outstanding
            FROM wholesale_payments wp
            GROUP BY wp.customer_id
        ),
        payment_trend AS (
            -- Payment trend: slope of days_overdue over last 6 payments
            SELECT
                customer_id,
                -- Simple slope approximation: (avg of recent 3 - avg of prior 3) overdue days
                COALESCE(
                    (SELECT AVG(sub.days_overdue) FROM (
                        SELECT days_overdue FROM wholesale_payments wp2
                        WHERE wp2.customer_id = wp_outer.customer_id
                        ORDER BY payment_date DESC LIMIT 3
                    ) sub)
                    -
                    (SELECT AVG(sub2.days_overdue) FROM (
                        SELECT days_overdue FROM wholesale_payments wp3
                        WHERE wp3.customer_id = wp_outer.customer_id
                        ORDER BY payment_date DESC LIMIT 6 OFFSET 3
                    ) sub2),
                    0
                ) AS payment_trend_slope
            FROM wholesale_payments wp_outer
            GROUP BY customer_id
        ),
        order_stats AS (
            SELECT
                t.customer_id,
                -- Frequency change: recent 60 days vs prior 60 days
                CASE
                    WHEN COUNT(DISTINCT CASE
                        WHEN t.transaction_date >= NOW() - INTERVAL '120 days'
                         AND t.transaction_date < NOW() - INTERVAL '60 days'
                        THEN t.transaction_id END) > 0
                    THEN (
                        COUNT(DISTINCT CASE
                            WHEN t.transaction_date >= NOW() - INTERVAL '60 days'
                            THEN t.transaction_id END)::float
                        / NULLIF(COUNT(DISTINCT CASE
                            WHEN t.transaction_date >= NOW() - INTERVAL '120 days'
                             AND t.transaction_date < NOW() - INTERVAL '60 days'
                            THEN t.transaction_id END)::float, 1)
                    ) - 1.0
                    ELSE 0
                END AS order_frequency_change,
                -- Basket size change
                CASE
                    WHEN COALESCE(AVG(CASE
                        WHEN t.transaction_date >= NOW() - INTERVAL '120 days'
                         AND t.transaction_date < NOW() - INTERVAL '60 days'
                        THEN CAST(t.total_amount AS numeric) END), 0) > 0
                    THEN (
                        COALESCE(AVG(CASE
                            WHEN t.transaction_date >= NOW() - INTERVAL '60 days'
                            THEN CAST(t.total_amount AS numeric) END), 0)
                        / NULLIF(AVG(CASE
                            WHEN t.transaction_date >= NOW() - INTERVAL '120 days'
                             AND t.transaction_date < NOW() - INTERVAL '60 days'
                            THEN CAST(t.total_amount AS numeric) END), 1)
                    ) - 1.0
                    ELSE 0
                END AS basket_size_change,
                -- Total lifetime spend
                SUM(CAST(t.total_amount AS numeric)) AS total_lifetime_spend
            FROM transactions t
            WHERE t.transaction_type = 'wholesale'
            GROUP BY t.customer_id
        )
        SELECT
            c.customer_id,
            COALESCE(ps.avg_days_overdue, 0) AS avg_days_overdue,
            COALESCE(ps.max_days_overdue_last_90d, 0) AS max_days_overdue_last_90d,
            COALESCE(pt.payment_trend_slope, 0) AS payment_trend_slope,
            -- Credit utilization = outstanding / credit_limit
            CASE
                WHEN CAST(c.credit_limit AS numeric) > 0
                THEN COALESCE(CAST(ps.latest_outstanding AS numeric), 0)
                     / CAST(c.credit_limit AS numeric)
                ELSE 0
            END AS credit_utilization,
            COALESCE(os.order_frequency_change, 0) AS order_frequency_change,
            COALESCE(os.basket_size_change, 0) AS basket_size_change,
            -- Account age in days
            EXTRACT(EPOCH FROM (NOW() - c.registration_date::timestamp)) / 86400.0
                AS account_age_days,
            COALESCE(os.total_lifetime_spend, 0) AS total_lifetime_spend,
            COALESCE(CAST(ps.latest_outstanding AS numeric), 0) AS outstanding_balance,
            CAST(c.credit_limit AS numeric) AS credit_limit
        FROM customers c
        LEFT JOIN payment_stats ps ON c.customer_id = ps.customer_id
        LEFT JOIN payment_trend pt ON c.customer_id = pt.customer_id
        LEFT JOIN order_stats os ON c.customer_id = os.customer_id
        WHERE c.customer_type = 'wholesale'
          AND c.status = 'active'
          AND CAST(c.credit_limit AS numeric) > 0
    """
    rows = execute_query(query)
    if not rows:
        return pd.DataFrame()

    df = pd.DataFrame(rows)
    for col in FEATURE_NAMES + ['outstanding_balance', 'credit_limit']:
        df[col] = pd.to_numeric(df[col], errors='coerce').fillna(0)

    return df


def _determine_risk_level(score):
    """Map risk score to risk level string."""
    if score < 0.3:
        return 'low'
    elif score < 0.5:
        return 'medium'
    elif score < 0.7:
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


def _upsert_credit_scores(df):
    """Write credit risk scores to the database."""
    if df.empty:
        return

    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM credit_risk_scores")

            values = [
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

            psycopg2.extras.execute_values(
                cur,
                """
                INSERT INTO credit_risk_scores
                    (customer_id, risk_score, risk_level, outstanding_balance,
                     credit_utilization, avg_days_overdue, payment_trend,
                     top_risk_factor, updated_at)
                VALUES %s
                """,
                values,
                template="(%s, %s, %s, %s, %s, %s, %s, %s, NOW())"
            )

            conn.commit()
    finally:
        conn.close()


def run_credit_risk_scoring(params):
    """
    Run credit risk scoring for all wholesale customers with credit lines.

    Uses a heuristic-weighted logistic regression approach. If insufficient
    labeled data exists for supervised learning, falls back to a rule-based
    risk score combining key credit indicators.

    Args:
        params: dict (reserved for future use)

    Returns:
        dict with 'summary' describing results and risk distribution
    """
    try:
        df = _fetch_credit_features()

        if df.empty or len(df) < 5:
            return {
                'summary': 'Not enough wholesale customers with credit lines for risk scoring',
            }

        X = df[FEATURE_NAMES].values

        # Create synthetic labels for training based on business rules:
        # "high risk" if avg_days_overdue > 15 OR max_overdue_90d > 30 OR credit_util > 0.8
        y_synthetic = (
            (df['avg_days_overdue'] > 15).astype(int) |
            (df['max_days_overdue_last_90d'] > 30).astype(int) |
            (df['credit_utilization'] > 0.8).astype(int)
        ).values

        # Scale features
        scaler = StandardScaler()
        X_scaled = scaler.fit_transform(X)

        unique_labels = np.unique(y_synthetic)
        if len(unique_labels) >= 2 and len(df) >= 10:
            # Train logistic regression with synthetic labels
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
            # Fallback: rule-based scoring
            risk_scores = (
                0.25 * np.clip(df['avg_days_overdue'].values / 30.0, 0, 1) +
                0.25 * np.clip(df['max_days_overdue_last_90d'].values / 60.0, 0, 1) +
                0.20 * np.clip(df['credit_utilization'].values, 0, 1) +
                0.15 * np.clip(-df['order_frequency_change'].values, 0, 1) +
                0.15 * np.clip(df['payment_trend_slope'].values / 5.0, 0, 1)
            )
            risk_scores = np.clip(risk_scores, 0, 1)

            # Determine top factor per customer using rule weights
            factor_scores = pd.DataFrame({
                'avg_days_overdue': np.clip(df['avg_days_overdue'].values / 30.0, 0, 1) * 0.25,
                'max_days_overdue_last_90d': np.clip(df['max_days_overdue_last_90d'].values / 60.0, 0, 1) * 0.25,
                'credit_utilization': np.clip(df['credit_utilization'].values, 0, 1) * 0.20,
                'order_frequency_change': np.clip(-df['order_frequency_change'].values, 0, 1) * 0.15,
                'payment_trend_slope': np.clip(df['payment_trend_slope'].values / 5.0, 0, 1) * 0.15,
            })
            top_factors = factor_scores.idxmax(axis=1)
            df['top_risk_factor'] = top_factors.map(RISK_FACTOR_LABELS).fillna('General risk')

        df['risk_score'] = risk_scores
        df['risk_level'] = df['risk_score'].apply(_determine_risk_level)
        df['payment_trend'] = df['payment_trend_slope'].apply(_determine_payment_trend)

        # Write to database
        _upsert_credit_scores(df)

        risk_distribution = df['risk_level'].value_counts().to_dict()
        dist_str = ", ".join(f"{k}: {v}" for k, v in risk_distribution.items())

        return {
            'summary': (
                f"Scored {len(df)} wholesale customers for credit risk. "
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
