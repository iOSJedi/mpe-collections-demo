"""
Cash Flow Forecasting for the collections portal.

Projects monthly inflow (from incoming_payments) and outflow (from
outgoing_payments) 6 months into the future. Uses a simple time-series
approach: compute the rolling average of the last N months and project
it forward. Confidence intervals are ±20% of the forecast value.

Results are written to the cash_flow_forecasts table.
"""

import pandas as pd
import numpy as np
from datetime import date, timedelta
from dateutil.relativedelta import relativedelta
from .db import execute_query, upsert_cash_flow_forecasts


FORECAST_MONTHS = 6    # how many months ahead to forecast
LOOKBACK_MONTHS = 6    # how many historical months to average


def _fetch_monthly_inflows():
    """
    Aggregate incoming_payments by calendar month.
    Returns a dict {year_month_str: total_amount}.
    """
    query = """
        SELECT
            TO_CHAR(payment_date, 'YYYY-MM') AS month,
            SUM(CAST(amount AS numeric))      AS total
        FROM incoming_payments
        WHERE payment_date IS NOT NULL
          AND payment_date >= NOW() - INTERVAL '%s months'
        GROUP BY TO_CHAR(payment_date, 'YYYY-MM')
        ORDER BY month
    """ % (LOOKBACK_MONTHS + 1)

    rows = execute_query(query)
    if not rows:
        return {}

    return {row['month']: float(row['total'] or 0) for row in rows}


def _fetch_monthly_outflows():
    """
    Aggregate outgoing_payments by calendar month.
    Returns a dict {year_month_str: total_amount}.
    """
    query = """
        SELECT
            TO_CHAR(payment_date, 'YYYY-MM') AS month,
            SUM(CAST(amount AS numeric))      AS total
        FROM outgoing_payments
        WHERE payment_date IS NOT NULL
          AND payment_date >= NOW() - INTERVAL '%s months'
        GROUP BY TO_CHAR(payment_date, 'YYYY-MM')
        ORDER BY month
    """ % (LOOKBACK_MONTHS + 1)

    rows = execute_query(query)
    if not rows:
        return {}

    return {row['month']: float(row['total'] or 0) for row in rows}


def _last_n_months(n):
    """Return a list of YYYY-MM strings for the last n complete months."""
    today = date.today()
    # start from the beginning of the current month then go back
    first_of_current = today.replace(day=1)
    months = []
    for i in range(1, n + 1):
        m = first_of_current - relativedelta(months=i)
        months.append(m.strftime('%Y-%m'))
    return list(reversed(months))


def _compute_average(monthly_data, months):
    """Compute the mean of the given months from monthly_data dict."""
    values = [monthly_data.get(m, 0.0) for m in months]
    return float(np.mean(values)) if values else 0.0


def _build_forecast_rows(avg_inflow, avg_outflow):
    """
    Build forecast rows for the next FORECAST_MONTHS months.
    Confidence interval: ±20% of the forecast value.
    """
    rows = []
    today = date.today()
    first_of_next = today.replace(day=1) + relativedelta(months=1)

    for i in range(FORECAST_MONTHS):
        forecast_month = first_of_next + relativedelta(months=i)
        month_str = forecast_month.strftime('%Y-%m-%d')  # first day of month

        rows.append((
            month_str,
            round(avg_inflow, 2),
            round(avg_inflow * 0.80, 2),
            round(avg_inflow * 1.20, 2),
            round(avg_outflow, 2),
            round(avg_outflow * 0.80, 2),
            round(avg_outflow * 1.20, 2),
            LOOKBACK_MONTHS,
        ))

    return rows


def run_demand_forecast(params):
    """
    Run cash flow forecasting: project inflows and outflows 6 months ahead.

    Args:
        params: dict (reserved for future use)

    Returns:
        dict with 'summary' describing results
    """
    try:
        historical_months = _last_n_months(LOOKBACK_MONTHS)

        inflows = _fetch_monthly_inflows()
        outflows = _fetch_monthly_outflows()

        avg_inflow = _compute_average(inflows, historical_months)
        avg_outflow = _compute_average(outflows, historical_months)

        rows = _build_forecast_rows(avg_inflow, avg_outflow)
        upsert_cash_flow_forecasts(rows)

        net_flow = avg_inflow - avg_outflow
        net_label = "positive" if net_flow >= 0 else "negative"

        return {
            'summary': (
                f"Generated {FORECAST_MONTHS}-month cash flow forecast "
                f"based on {LOOKBACK_MONTHS}-month average. "
                f"Projected monthly inflow: {avg_inflow:,.2f}, "
                f"outflow: {avg_outflow:,.2f} "
                f"(net {net_label}: {abs(net_flow):,.2f})."
            ),
            'forecast_months': FORECAST_MONTHS,
            'avg_monthly_inflow': round(avg_inflow, 2),
            'avg_monthly_outflow': round(avg_outflow, 2),
            'net_monthly_flow': round(net_flow, 2),
        }

    except Exception as e:
        return {
            'summary': f"Cash flow forecasting failed: {str(e)}",
            'error': str(e),
        }
