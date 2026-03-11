"""
Payment Patterns analysis for AR customers.

Computes per-customer payment behaviour metrics from the invoices and
incoming_payments tables:
  - avg_days_to_pay: average days from invoice issue date to payment date
  - preferred_method: mode of payment_method across all payments
  - typical_payment_day: mode of day-of-month of payment_date
  - partial_payment_rate: fraction of payments where amount < invoice amount

Results are written to the payment_patterns table.
"""

import pandas as pd
import numpy as np
from .db import execute_query, upsert_payment_patterns


def _fetch_payment_data():
    """
    Fetch raw payment data joined to invoice info for all customers.
    """
    query = """
        SELECT
            i.customer_id,
            ip.payment_id,
            ip.payment_date,
            ip.payment_method,
            CAST(ip.amount AS numeric)    AS payment_amount,
            CAST(i.amount AS numeric)     AS invoice_amount,
            i.issue_date
        FROM incoming_payments ip
        JOIN invoices i ON ip.invoice_id = i.invoice_id
        WHERE ip.payment_date IS NOT NULL
          AND i.customer_id IS NOT NULL
        ORDER BY i.customer_id, ip.payment_date
    """
    rows = execute_query(query)
    if not rows:
        return pd.DataFrame()

    df = pd.DataFrame(rows)
    df['payment_date'] = pd.to_datetime(df['payment_date'])
    df['issue_date'] = pd.to_datetime(df['issue_date'])
    df['payment_amount'] = pd.to_numeric(df['payment_amount'], errors='coerce').fillna(0)
    df['invoice_amount'] = pd.to_numeric(df['invoice_amount'], errors='coerce').fillna(0)

    return df


def _mode_or_none(series):
    """Return the mode of a series, or None if empty."""
    if series.empty:
        return None
    mode = series.mode()
    return mode.iloc[0] if not mode.empty else None


def _compute_patterns(df):
    """
    Aggregate per-customer payment pattern metrics.
    Returns a DataFrame with one row per customer_id.
    """
    results = []

    for customer_id, group in df.groupby('customer_id'):
        # avg_days_to_pay
        days_to_pay = (group['payment_date'] - group['issue_date']).dt.days
        avg_days_to_pay = float(days_to_pay.mean()) if not days_to_pay.empty else None

        # preferred_method
        preferred_method = _mode_or_none(group['payment_method'])

        # typical_payment_day (day-of-month)
        payment_days = group['payment_date'].dt.day
        typical_payment_day = int(_mode_or_none(payment_days)) if not payment_days.empty else None

        # partial_payment_rate
        valid = group[group['invoice_amount'] > 0]
        if not valid.empty:
            partial_mask = valid['payment_amount'] < valid['invoice_amount']
            partial_payment_rate = float(partial_mask.sum() / len(valid))
        else:
            partial_payment_rate = 0.0

        results.append({
            'customer_id': customer_id,
            'avg_days_to_pay': avg_days_to_pay,
            'preferred_method': preferred_method,
            'typical_payment_day': typical_payment_day,
            'partial_payment_rate': partial_payment_rate,
        })

    return pd.DataFrame(results)


def run_basket_analysis(params):
    """
    Compute and store payment patterns for all customers.

    Args:
        params: dict (reserved for future filters)

    Returns:
        dict with 'summary' describing results
    """
    try:
        df = _fetch_payment_data()

        if df.empty:
            return {'summary': 'No payment data found for pattern analysis'}

        patterns = _compute_patterns(df)

        if patterns.empty:
            return {'summary': 'No patterns could be computed from payment data'}

        rows = [
            (
                row['customer_id'],
                float(row['avg_days_to_pay']) if row['avg_days_to_pay'] is not None else None,
                row['preferred_method'],
                row['typical_payment_day'],
                float(row['partial_payment_rate']),
            )
            for _, row in patterns.iterrows()
        ]
        upsert_payment_patterns(rows)

        avg_days = patterns['avg_days_to_pay'].mean()
        partial_rate = patterns['partial_payment_rate'].mean()

        return {
            'summary': (
                f"Computed payment patterns for {len(patterns)} customers. "
                f"Average days-to-pay: {avg_days:.1f}, "
                f"Average partial payment rate: {partial_rate:.1%}"
            ),
            'customer_count': len(patterns),
            'avg_days_to_pay': round(float(avg_days), 2) if not np.isnan(avg_days) else None,
            'avg_partial_payment_rate': round(float(partial_rate), 4),
        }

    except Exception as e:
        return {
            'summary': f"Payment pattern analysis failed: {str(e)}",
            'error': str(e),
        }
