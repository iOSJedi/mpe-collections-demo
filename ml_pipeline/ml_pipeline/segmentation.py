"""
Payer Segmentation using RAT (Regularity, Amount, Timeliness) analysis + K-Means.

Computes three normalized scores per customer:
  - Regularity: std-dev of days between payments (lower = more regular)
  - Amount: average (payment / invoice) ratio (higher = pays more)
  - Timeliness: average days from invoice issue to payment (lower = more timely)

K-Means (k=5) clusters customers and labels them with human-readable segment names.
Results are written to the payer_segments table.
"""

from sklearn.cluster import KMeans
from sklearn.preprocessing import StandardScaler
import pandas as pd
import numpy as np
from .db import get_connection, execute_query, upsert_payer_segments
import psycopg2.extras


SEGMENT_LABELS = [
    "Reliable Payer",
    "Occasional Late",
    "Partial Payer",
    "Chronic Delinquent",
    "New Customer",
]


def _fetch_rat_data():
    """
    Fetch per-customer Regularity, Amount, and Timeliness metrics from the
    invoices and incoming_payments tables.
    """
    query = """
        WITH payment_gaps AS (
            -- Days between successive payments per customer
            SELECT
                i.customer_id,
                ip.payment_date,
                LAG(ip.payment_date) OVER (
                    PARTITION BY i.customer_id ORDER BY ip.payment_date
                ) AS prev_payment_date
            FROM incoming_payments ip
            JOIN invoices i ON ip.invoice_id = i.invoice_id
        ),
        regularity AS (
            SELECT
                customer_id,
                STDDEV(
                    EXTRACT(EPOCH FROM (payment_date - prev_payment_date)) / 86400.0
                ) AS regularity_stddev,
                COUNT(*) AS payment_count
            FROM payment_gaps
            WHERE prev_payment_date IS NOT NULL
            GROUP BY customer_id
        ),
        amount_ratio AS (
            SELECT
                i.customer_id,
                AVG(
                    CAST(ip.amount AS numeric) /
                    NULLIF(CAST(i.amount AS numeric), 0)
                ) AS avg_amount_ratio
            FROM incoming_payments ip
            JOIN invoices i ON ip.invoice_id = i.invoice_id
            GROUP BY i.customer_id
        ),
        timeliness AS (
            SELECT
                i.customer_id,
                AVG(
                    EXTRACT(EPOCH FROM (ip.payment_date::timestamp - i.issue_date::timestamp))
                    / 86400.0
                ) AS avg_days_to_pay
            FROM incoming_payments ip
            JOIN invoices i ON ip.invoice_id = i.invoice_id
            GROUP BY i.customer_id
        )
        SELECT
            c.customer_id,
            COALESCE(r.regularity_stddev, 0)   AS regularity,
            COALESCE(a.avg_amount_ratio, 0)     AS amount,
            COALESCE(t.avg_days_to_pay, 999)    AS timeliness,
            COALESCE(r.payment_count, 0)        AS payment_count
        FROM customers c
        LEFT JOIN regularity r ON c.customer_id = r.customer_id
        LEFT JOIN amount_ratio a ON c.customer_id = a.customer_id
        LEFT JOIN timeliness t ON c.customer_id = t.customer_id
        WHERE c.status = 'active'
    """
    rows = execute_query(query)
    if not rows:
        return pd.DataFrame()

    df = pd.DataFrame(rows)
    for col in ['regularity', 'amount', 'timeliness', 'payment_count']:
        df[col] = pd.to_numeric(df[col], errors='coerce').fillna(0)

    return df


def _normalize_features(df):
    """
    Normalize the three RAT dimensions to [0, 1] range so K-Means treats
    each dimension equally, then invert regularity and timeliness so that
    "higher is better" across all dimensions.
    """
    # Regularity: lower stddev is better → invert (cap at 180 days for outliers)
    df['reg_norm'] = 1.0 - np.clip(df['regularity'] / 180.0, 0.0, 1.0)

    # Amount: already a ratio, cap at 1
    df['amt_norm'] = np.clip(df['amount'], 0.0, 1.0)

    # Timeliness: lower days-to-pay is better → invert (cap at 180 days)
    df['time_norm'] = 1.0 - np.clip(df['timeliness'] / 180.0, 0.0, 1.0)

    return df


def _assign_label(centroid, k):
    """
    Assign a human-readable label to a cluster centroid.
    centroid contains (reg_norm, amt_norm, time_norm) — all higher = better.
    """
    overall_score = np.mean(centroid)

    # New customers have very few payments — handle separately via payment_count check
    if overall_score >= 0.75:
        return "Reliable Payer"
    elif overall_score >= 0.50:
        return "Occasional Late"
    elif overall_score >= 0.30:
        return "Partial Payer"
    else:
        return "Chronic Delinquent"


def run_segmentation(params):
    """
    Run RAT + K-Means payer segmentation.

    Args:
        params: dict (reserved for future filters)

    Returns:
        dict with 'summary' describing results and segment distribution
    """
    try:
        df = _fetch_rat_data()

        if df.empty or len(df) < 5:
            return {
                'summary': 'Not enough customer data for segmentation (need >= 5 customers)',
            }

        df = _normalize_features(df)

        # Customers with 0 payments are "New Customer"
        new_mask = df['payment_count'] == 0
        df_new = df[new_mask].copy()
        df_existing = df[~new_mask].copy()

        df_new['segment_name'] = 'New Customer'
        df_new['cluster_id'] = -1
        df_new['reg_norm'] = 0.0
        df_new['amt_norm'] = 0.0
        df_new['time_norm'] = 0.0

        segment_rows = []

        if not df_existing.empty and len(df_existing) >= 4:
            features = df_existing[['reg_norm', 'amt_norm', 'time_norm']].values
            scaler = StandardScaler()
            features_scaled = scaler.fit_transform(features)

            n_clusters = min(4, len(df_existing))
            kmeans = KMeans(n_clusters=n_clusters, random_state=42, n_init=10)
            df_existing['cluster_id'] = kmeans.fit_predict(features_scaled)

            centroids_original = scaler.inverse_transform(kmeans.cluster_centers_)
            cluster_labels = {
                i: _assign_label(centroids_original[i], n_clusters)
                for i in range(n_clusters)
            }
            df_existing['segment_name'] = df_existing['cluster_id'].map(cluster_labels)
        else:
            # Not enough existing payers — label all based on overall score
            if not df_existing.empty:
                df_existing['cluster_id'] = 0
                df_existing['segment_name'] = df_existing.apply(
                    lambda r: _assign_label(
                        [r['reg_norm'], r['amt_norm'], r['time_norm']], 1
                    ),
                    axis=1,
                )

        df_all = pd.concat([df_existing, df_new], ignore_index=True)

        # Build upsert rows
        rows = [
            (
                row['customer_id'],
                row['segment_name'],
                float(row['reg_norm']),
                float(row['amt_norm']),
                float(row['time_norm']),
                int(row['cluster_id']),
            )
            for _, row in df_all.iterrows()
        ]
        upsert_payer_segments(rows)

        segment_counts = df_all['segment_name'].value_counts().to_dict()
        distribution = ", ".join(f"{name}: {count}" for name, count in segment_counts.items())

        return {
            'summary': (
                f"Segmented {len(df_all)} customers. "
                f"Distribution: {distribution}"
            ),
            'customer_count': len(df_all),
            'segment_distribution': segment_counts,
        }

    except Exception as e:
        return {
            'summary': f"Payer segmentation failed: {str(e)}",
            'error': str(e),
        }
