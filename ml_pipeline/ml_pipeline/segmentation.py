"""
Customer Segmentation using RFM analysis + K-Means clustering.

Calculates Recency, Frequency, Monetary values for each customer,
scores them 1-5 using quintiles, then runs K-Means (k=5) to discover
natural customer segments. Clusters are labeled based on centroid
characteristics.
"""

from sklearn.cluster import KMeans
from sklearn.preprocessing import StandardScaler
import pandas as pd
import numpy as np
from .db import get_connection, execute_query
import psycopg2.extras


# Segment labels mapped by centroid profile (R_high, F_high, M_high)
SEGMENT_LABELS = {
    (True, True, True): "High-Value Loyalist",
    (False, True, True): "At-Risk Big Spender",
    (True, False, False): "New / Occasional Shopper",
    (False, False, False): "Lapsed Customer",
}
DEFAULT_SEGMENT = "Steady Regular"


def _fetch_rfm_data():
    """Fetch raw transaction data and compute RFM metrics per customer."""
    query = """
        SELECT
            c.customer_id,
            MAX(t.transaction_date) AS last_transaction,
            COUNT(DISTINCT t.transaction_id) AS frequency,
            COALESCE(SUM(CAST(t.total_amount AS numeric)), 0) AS monetary
        FROM customers c
        JOIN transactions t ON c.customer_id = t.customer_id
        WHERE c.status = 'active'
          AND t.transaction_date >= NOW() - INTERVAL '6 months'
        GROUP BY c.customer_id
        HAVING COUNT(DISTINCT t.transaction_id) >= 1
    """
    rows = execute_query(query)
    if not rows:
        return pd.DataFrame()

    df = pd.DataFrame(rows)
    df['last_transaction'] = pd.to_datetime(df['last_transaction'])
    df['monetary'] = df['monetary'].astype(float)

    # Recency = days since last transaction
    now = pd.Timestamp.now()
    df['recency'] = (now - df['last_transaction']).dt.days

    return df[['customer_id', 'recency', 'frequency', 'monetary']]


def _score_quintiles(series, ascending=True):
    """
    Assign scores 1-5 based on quintiles.
    ascending=True means lower values get higher scores (used for recency:
    fewer days since last purchase = better).
    """
    try:
        labels = [5, 4, 3, 2, 1] if ascending else [1, 2, 3, 4, 5]
        return pd.qcut(series, q=5, labels=labels, duplicates='drop').astype(int)
    except ValueError:
        # Not enough unique values for 5 bins — fall back to rank-based scoring
        ranks = series.rank(method='min', ascending=ascending)
        return pd.cut(ranks, bins=5, labels=[1, 2, 3, 4, 5], duplicates='drop').astype(int)


def _label_cluster(centroid, overall_means):
    """
    Assign a human-readable label to a cluster based on its centroid position
    relative to overall means.
    """
    r_high = centroid[0] > overall_means[0]  # r_score above mean
    f_high = centroid[1] > overall_means[1]  # f_score above mean
    m_high = centroid[2] > overall_means[2]  # m_score above mean

    return SEGMENT_LABELS.get((r_high, f_high, m_high), DEFAULT_SEGMENT)


def _upsert_segments(df):
    """Write customer segment results to database."""
    if df.empty:
        return

    conn = get_connection()
    try:
        with conn.cursor() as cur:
            # Truncate and re-insert for a clean refresh
            cur.execute("DELETE FROM customer_segments")

            values = [
                (
                    row['customer_id'],
                    row['segment_name'],
                    int(row['recency']),
                    int(row['frequency']),
                    float(row['monetary']),
                    int(row['r_score']),
                    int(row['f_score']),
                    int(row['m_score']),
                    int(row['cluster_id']),
                )
                for _, row in df.iterrows()
            ]

            psycopg2.extras.execute_values(
                cur,
                """
                INSERT INTO customer_segments
                    (customer_id, segment_name, rfm_recency, rfm_frequency,
                     rfm_monetary, r_score, f_score, m_score, cluster_id, updated_at)
                VALUES %s
                """,
                values,
                template="(%s, %s, %s, %s, %s, %s, %s, %s, %s, NOW())"
            )

            conn.commit()
    finally:
        conn.close()


def run_segmentation(params):
    """
    Run RFM + K-Means customer segmentation.

    Args:
        params: dict (currently unused, reserved for future filters)

    Returns:
        dict with 'summary' describing results and segment distribution
    """
    try:
        df = _fetch_rfm_data()

        if df.empty or len(df) < 10:
            return {
                'summary': 'Not enough customer data for segmentation (need >= 10 customers)',
            }

        # Score each RFM dimension 1-5
        df['r_score'] = _score_quintiles(df['recency'], ascending=True)   # lower recency = higher score
        df['f_score'] = _score_quintiles(df['frequency'], ascending=False)  # higher frequency = higher score
        df['m_score'] = _score_quintiles(df['monetary'], ascending=False)   # higher monetary = higher score

        # Standardize for K-Means
        features = df[['r_score', 'f_score', 'm_score']].values
        scaler = StandardScaler()
        features_scaled = scaler.fit_transform(features)

        # K-Means with k=5
        n_clusters = min(5, len(df))
        kmeans = KMeans(n_clusters=n_clusters, random_state=42, n_init=10)
        df['cluster_id'] = kmeans.fit_predict(features_scaled)

        # Label clusters based on centroid characteristics
        overall_means = features.mean(axis=0)  # mean of r_score, f_score, m_score
        centroids_original = scaler.inverse_transform(kmeans.cluster_centers_)

        cluster_labels = {}
        for i in range(n_clusters):
            cluster_labels[i] = _label_cluster(centroids_original[i], overall_means)

        df['segment_name'] = df['cluster_id'].map(cluster_labels)

        # Write to database
        _upsert_segments(df)

        # Build segment distribution summary
        segment_counts = df['segment_name'].value_counts().to_dict()
        distribution = ", ".join(
            f"{name}: {count}" for name, count in segment_counts.items()
        )

        return {
            'summary': (
                f"Segmented {len(df)} customers into {n_clusters} clusters. "
                f"Distribution: {distribution}"
            ),
            'customer_count': len(df),
            'segment_distribution': segment_counts,
        }

    except Exception as e:
        return {
            'summary': f"Segmentation failed: {str(e)}",
            'error': str(e),
        }
