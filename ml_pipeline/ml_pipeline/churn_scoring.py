"""
Churn Scoring using Logistic Regression.

Defines churn as: 0 purchases in last 30 days but >= 2 in the 90 days before that.
Features include days since last purchase, average gap between purchases,
frequency change, basket size change, category diversity, and payment method diversity.
Scores all active customers and maps probability to risk levels.
"""

from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
import pandas as pd
import numpy as np
from .db import get_connection, execute_query
import psycopg2.extras


FEATURE_NAMES = [
    'days_since_last',
    'avg_days_between',
    'frequency_change',
    'basket_change',
    'unique_categories',
    'payment_method_diversity',
]

RISK_FACTOR_LABELS = {
    'days_since_last': 'Long time since last purchase',
    'avg_days_between': 'Increasing gap between purchases',
    'frequency_change': 'Declining purchase frequency',
    'basket_change': 'Shrinking basket size',
    'unique_categories': 'Low category engagement',
    'payment_method_diversity': 'Limited payment flexibility',
}


def _fetch_churn_features():
    """
    Fetch per-customer features for churn prediction.
    Returns a DataFrame with customer_id, all features, and a churn label.
    """
    query = """
        WITH customer_stats AS (
            SELECT
                c.customer_id,
                -- Days since last transaction
                EXTRACT(EPOCH FROM (NOW() - MAX(t.transaction_date))) / 86400.0
                    AS days_since_last,
                -- Average days between transactions
                CASE
                    WHEN COUNT(DISTINCT t.transaction_id) > 1 THEN
                        EXTRACT(EPOCH FROM (MAX(t.transaction_date) - MIN(t.transaction_date)))
                        / NULLIF(COUNT(DISTINCT t.transaction_id) - 1, 0) / 86400.0
                    ELSE 999
                END AS avg_days_between,
                -- Frequency in recent 30 days
                COUNT(DISTINCT CASE
                    WHEN t.transaction_date >= NOW() - INTERVAL '30 days'
                    THEN t.transaction_id END) AS freq_recent_30,
                -- Frequency in 31-120 days ago (the 90 days before last 30)
                COUNT(DISTINCT CASE
                    WHEN t.transaction_date >= NOW() - INTERVAL '120 days'
                     AND t.transaction_date < NOW() - INTERVAL '30 days'
                    THEN t.transaction_id END) AS freq_prior_90,
                -- Frequency change: (recent 30d rate) vs (prior 90d rate, normalized to 30d)
                CASE
                    WHEN COUNT(DISTINCT CASE
                        WHEN t.transaction_date >= NOW() - INTERVAL '120 days'
                         AND t.transaction_date < NOW() - INTERVAL '30 days'
                        THEN t.transaction_id END) > 0
                    THEN (
                        COUNT(DISTINCT CASE
                            WHEN t.transaction_date >= NOW() - INTERVAL '30 days'
                            THEN t.transaction_id END)::float
                        / (COUNT(DISTINCT CASE
                            WHEN t.transaction_date >= NOW() - INTERVAL '120 days'
                             AND t.transaction_date < NOW() - INTERVAL '30 days'
                            THEN t.transaction_id END)::float / 3.0)
                    ) - 1.0
                    ELSE 0
                END AS frequency_change,
                -- Average basket size change
                CASE
                    WHEN COALESCE(AVG(CASE
                        WHEN t.transaction_date >= NOW() - INTERVAL '120 days'
                         AND t.transaction_date < NOW() - INTERVAL '30 days'
                        THEN CAST(t.total_amount AS numeric) END), 0) > 0
                    THEN (
                        COALESCE(AVG(CASE
                            WHEN t.transaction_date >= NOW() - INTERVAL '30 days'
                            THEN CAST(t.total_amount AS numeric) END), 0)
                        / COALESCE(AVG(CASE
                            WHEN t.transaction_date >= NOW() - INTERVAL '120 days'
                             AND t.transaction_date < NOW() - INTERVAL '30 days'
                            THEN CAST(t.total_amount AS numeric) END), 1)
                    ) - 1.0
                    ELSE 0
                END AS basket_change,
                -- Unique categories purchased
                COUNT(DISTINCT p.category) AS unique_categories,
                -- Payment method diversity
                COUNT(DISTINCT t.payment_method) AS payment_method_diversity,
                -- Total transactions in last 6 months
                COUNT(DISTINCT CASE
                    WHEN t.transaction_date >= NOW() - INTERVAL '6 months'
                    THEN t.transaction_id END) AS total_txn_6m
            FROM customers c
            JOIN transactions t ON c.customer_id = t.customer_id
            LEFT JOIN transaction_items ti ON t.transaction_id = ti.transaction_id
            LEFT JOIN products p ON ti.product_id = p.product_id
            WHERE c.status = 'active'
              AND t.transaction_date >= NOW() - INTERVAL '6 months'
            GROUP BY c.customer_id
        )
        SELECT
            customer_id,
            days_since_last,
            avg_days_between,
            frequency_change,
            basket_change,
            unique_categories,
            payment_method_diversity,
            freq_recent_30,
            freq_prior_90,
            total_txn_6m,
            -- Churn label: 0 purchases in last 30 days AND >= 2 in prior 90 days
            CASE
                WHEN freq_recent_30 = 0 AND freq_prior_90 >= 2 THEN 1
                ELSE 0
            END AS churned
        FROM customer_stats
        WHERE total_txn_6m >= 1
    """
    rows = execute_query(query)
    if not rows:
        return pd.DataFrame()

    df = pd.DataFrame(rows)
    for col in FEATURE_NAMES + ['churned']:
        df[col] = pd.to_numeric(df[col], errors='coerce').fillna(0)

    return df


def _determine_risk_level(prob):
    """Map churn probability to risk level string."""
    if prob < 0.3:
        return 'low'
    elif prob < 0.5:
        return 'medium'
    elif prob < 0.7:
        return 'high'
    else:
        return 'critical'


def _top_risk_factor(features_row, coefficients):
    """
    Determine the top risk factor for a customer based on feature values
    weighted by model coefficients.
    """
    weighted = np.abs(features_row * coefficients)
    top_idx = np.argmax(weighted)
    return RISK_FACTOR_LABELS.get(FEATURE_NAMES[top_idx], FEATURE_NAMES[top_idx])


def _upsert_churn_scores(df):
    """Write churn scores to the database."""
    if df.empty:
        return

    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM churn_scores")

            values = [
                (
                    row['customer_id'],
                    float(row['churn_probability']),
                    row['risk_level'],
                    int(row['days_since_last']),
                    float(row['frequency_change']),
                    float(row['basket_change']),
                    row['top_risk_factor'],
                )
                for _, row in df.iterrows()
            ]

            psycopg2.extras.execute_values(
                cur,
                """
                INSERT INTO churn_scores
                    (customer_id, churn_probability, risk_level, days_since_last,
                     frequency_change, basket_change, top_risk_factor, updated_at)
                VALUES %s
                """,
                values,
                template="(%s, %s, %s, %s, %s, %s, %s, NOW())"
            )

            conn.commit()
    finally:
        conn.close()


def run_churn_scoring(params):
    """
    Run logistic regression churn scoring for all active customers.

    Args:
        params: dict (reserved for future use)

    Returns:
        dict with 'summary' describing results and risk distribution
    """
    try:
        df = _fetch_churn_features()

        if df.empty or len(df) < 20:
            return {
                'summary': 'Not enough customer data for churn scoring (need >= 20 customers)',
            }

        X = df[FEATURE_NAMES].values
        y = df['churned'].values

        # Check if we have both classes
        unique_labels = np.unique(y)
        if len(unique_labels) < 2:
            # If no churn observed, assign low probability to all
            df['churn_probability'] = 0.1
            df['risk_level'] = 'low'
            df['top_risk_factor'] = 'No churn patterns detected'
            _upsert_churn_scores(df)
            return {
                'summary': (
                    f"Scored {len(df)} customers. No churn patterns detected — "
                    f"all customers assigned low risk."
                ),
                'customer_count': len(df),
            }

        # Scale features
        scaler = StandardScaler()
        X_scaled = scaler.fit_transform(X)

        # Train/test split for validation
        X_train, X_test, y_train, y_test = train_test_split(
            X_scaled, y, test_size=0.2, random_state=42, stratify=y
        )

        # Train logistic regression
        model = LogisticRegression(
            random_state=42,
            max_iter=1000,
            class_weight='balanced',  # Handle class imbalance
        )
        model.fit(X_train, y_train)

        # Score ALL customers (not just test set)
        X_all_scaled = scaler.transform(X[: len(df)])
        probabilities = model.predict_proba(X_all_scaled)[:, 1]

        df['churn_probability'] = probabilities
        df['risk_level'] = df['churn_probability'].apply(_determine_risk_level)

        # Determine top risk factor per customer
        coefficients = model.coef_[0]
        df['top_risk_factor'] = df.apply(
            lambda row: _top_risk_factor(
                row[FEATURE_NAMES].values.astype(float), coefficients
            ),
            axis=1,
        )

        # Write to database
        _upsert_churn_scores(df)

        # Calculate test accuracy for summary
        test_accuracy = model.score(X_test, y_test)
        risk_distribution = df['risk_level'].value_counts().to_dict()
        dist_str = ", ".join(f"{k}: {v}" for k, v in risk_distribution.items())

        return {
            'summary': (
                f"Scored {len(df)} customers for churn risk "
                f"(model accuracy: {test_accuracy:.1%}). "
                f"Risk distribution: {dist_str}"
            ),
            'customer_count': len(df),
            'model_accuracy': float(test_accuracy),
            'risk_distribution': risk_distribution,
        }

    except Exception as e:
        return {
            'summary': f"Churn scoring failed: {str(e)}",
            'error': str(e),
        }
