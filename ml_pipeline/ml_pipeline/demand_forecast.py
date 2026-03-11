"""
Demand Forecasting using Facebook Prophet.

Forecasts daily sales quantity for the top 50 products by volume and
all product categories, broken down by branch. Incorporates Philippine
holidays (Christmas, New Year, Holy Week, All Saints Day, Independence Day).
Produces 30-day forecasts with confidence intervals.
"""

from prophet import Prophet
import pandas as pd
import numpy as np
from .db import get_connection, execute_query
import psycopg2.extras
import logging

# Suppress Prophet's verbose logging
logging.getLogger('cmdstanpy').setLevel(logging.WARNING)
logging.getLogger('prophet').setLevel(logging.WARNING)


def _get_philippine_holidays():
    """
    Build a DataFrame of Philippine holidays for Prophet.
    Covers 2024-2027 to ensure training and forecast periods are included.
    """
    holidays = []
    for year in range(2024, 2028):
        holidays.extend([
            {'holiday': 'christmas_season', 'ds': f'{year}-12-25',
             'lower_window': -7, 'upper_window': 1},
            {'holiday': 'new_year', 'ds': f'{year}-01-01',
             'lower_window': -1, 'upper_window': 1},
            {'holiday': 'all_saints_day', 'ds': f'{year}-11-01',
             'lower_window': -1, 'upper_window': 1},
            {'holiday': 'independence_day', 'ds': f'{year}-06-12',
             'lower_window': 0, 'upper_window': 0},
        ])

    # Holy Week (approximate dates — Maundy Thursday + Good Friday)
    holy_week_dates = {
        2024: ('2024-03-28', '2024-03-29'),
        2025: ('2025-04-17', '2025-04-18'),
        2026: ('2026-04-02', '2026-04-03'),
        2027: ('2027-03-25', '2027-03-26'),
    }
    for year, (thu, fri) in holy_week_dates.items():
        holidays.append({'holiday': 'holy_week', 'ds': thu,
                         'lower_window': -1, 'upper_window': 0})
        holidays.append({'holiday': 'holy_week', 'ds': fri,
                         'lower_window': 0, 'upper_window': 0})

    return pd.DataFrame(holidays)


def _fetch_top_products(limit=50):
    """Fetch top N products by total quantity sold in last 6 months."""
    query = """
        SELECT
            ti.product_id,
            SUM(ti.quantity) AS total_qty
        FROM transaction_items ti
        JOIN transactions t ON ti.transaction_id = t.transaction_id
        WHERE t.transaction_date >= NOW() - INTERVAL '6 months'
        GROUP BY ti.product_id
        ORDER BY total_qty DESC
        LIMIT %s
    """
    return execute_query(query, (limit,))


def _fetch_categories():
    """Fetch all active product categories."""
    query = """
        SELECT DISTINCT category
        FROM products
        WHERE is_active = true
        ORDER BY category
    """
    return execute_query(query)


def _fetch_branches():
    """Fetch all active branches."""
    query = """
        SELECT branch_id
        FROM branches
        WHERE is_active = true
        ORDER BY branch_id
    """
    return execute_query(query)


def _fetch_product_daily_sales(product_id, branch_id):
    """Fetch daily sales quantity for a specific product at a branch."""
    query = """
        SELECT
            DATE(t.transaction_date) AS ds,
            SUM(ti.quantity) AS y
        FROM transaction_items ti
        JOIN transactions t ON ti.transaction_id = t.transaction_id
        WHERE ti.product_id = %s
          AND t.branch_id = %s
          AND t.transaction_date >= NOW() - INTERVAL '6 months'
        GROUP BY DATE(t.transaction_date)
        ORDER BY ds
    """
    return execute_query(query, (product_id, branch_id))


def _fetch_category_daily_sales(category, branch_id):
    """Fetch daily sales quantity for a product category at a branch."""
    query = """
        SELECT
            DATE(t.transaction_date) AS ds,
            SUM(ti.quantity) AS y
        FROM transaction_items ti
        JOIN transactions t ON ti.transaction_id = t.transaction_id
        JOIN products p ON ti.product_id = p.product_id
        WHERE p.category = %s
          AND t.branch_id = %s
          AND t.transaction_date >= NOW() - INTERVAL '6 months'
        GROUP BY DATE(t.transaction_date)
        ORDER BY ds
    """
    return execute_query(query, (category, branch_id))


def _run_prophet_forecast(daily_data, holidays_df, periods=30):
    """
    Fit Prophet model and generate forecast.

    Args:
        daily_data: list of dicts with 'ds' and 'y' keys
        holidays_df: DataFrame of holidays for Prophet
        periods: number of days to forecast

    Returns:
        DataFrame with forecast columns or None if insufficient data
    """
    if not daily_data or len(daily_data) < 14:
        return None

    df = pd.DataFrame(daily_data)
    df['ds'] = pd.to_datetime(df['ds'])
    df['y'] = pd.to_numeric(df['y'], errors='coerce').fillna(0).astype(float)

    # Need at least 14 data points for meaningful forecast
    if len(df) < 14 or df['y'].sum() == 0:
        return None

    model = Prophet(
        yearly_seasonality=True,
        weekly_seasonality=True,
        daily_seasonality=False,
        holidays=holidays_df,
        changepoint_prior_scale=0.05,  # Conservative trend changes
        seasonality_prior_scale=10.0,
    )

    # Suppress Stan output
    model.fit(df, suppress_logging=True if hasattr(Prophet.fit, 'suppress_logging') else False)

    future = model.make_future_dataframe(periods=periods)
    forecast = model.predict(future)

    # Return only the forecast period (future dates)
    forecast_only = forecast[forecast['ds'] > df['ds'].max()].copy()
    forecast_only['yhat'] = forecast_only['yhat'].clip(lower=0)
    forecast_only['yhat_lower'] = forecast_only['yhat_lower'].clip(lower=0)
    forecast_only['yhat_upper'] = forecast_only['yhat_upper'].clip(lower=0)

    return forecast_only[['ds', 'yhat', 'yhat_lower', 'yhat_upper']]


def _upsert_forecasts(forecasts):
    """Write demand forecasts to the database."""
    if not forecasts:
        return

    conn = get_connection()
    try:
        with conn.cursor() as cur:
            # Delete existing forecasts for the scopes we're updating
            cur.execute("DELETE FROM demand_forecasts")

            values = [
                (
                    f.get('product_id'),
                    f.get('category'),
                    f['branch_id'],
                    f['forecast_date'],
                    f['predicted_quantity'],
                    f['lower_bound'],
                    f['upper_bound'],
                    f.get('based_on_period', '6 months'),
                )
                for f in forecasts
            ]

            psycopg2.extras.execute_values(
                cur,
                """
                INSERT INTO demand_forecasts
                    (product_id, category, branch_id, forecast_date,
                     predicted_quantity, lower_bound, upper_bound,
                     based_on_period, updated_at)
                VALUES %s
                """,
                values,
                template="(%s, %s, %s, %s, %s, %s, %s, %s, NOW())"
            )

            conn.commit()
    finally:
        conn.close()


def run_demand_forecast(params):
    """
    Run Prophet demand forecasting for top products and all categories by branch.

    Args:
        params: dict with optional keys: branch_id (to limit to one branch)

    Returns:
        dict with 'summary' describing results
    """
    try:
        holidays_df = _get_philippine_holidays()
        all_forecasts = []
        product_count = 0
        category_count = 0

        # Get branches to process
        if params.get('branch_id'):
            branches = [{'branch_id': params['branch_id']}]
        else:
            branches = _fetch_branches()

        if not branches:
            return {'summary': 'No active branches found'}

        # --- Forecast top 50 products by branch ---
        top_products = _fetch_top_products(limit=50)

        for product_row in (top_products or []):
            product_id = product_row['product_id']

            for branch_row in branches:
                branch_id = branch_row['branch_id']

                daily_data = _fetch_product_daily_sales(product_id, branch_id)
                forecast_df = _run_prophet_forecast(daily_data, holidays_df)

                if forecast_df is not None and not forecast_df.empty:
                    product_count += 1
                    for _, row in forecast_df.iterrows():
                        all_forecasts.append({
                            'product_id': product_id,
                            'category': None,
                            'branch_id': branch_id,
                            'forecast_date': row['ds'].strftime('%Y-%m-%d'),
                            'predicted_quantity': round(float(row['yhat']), 2),
                            'lower_bound': round(float(row['yhat_lower']), 2),
                            'upper_bound': round(float(row['yhat_upper']), 2),
                            'based_on_period': '6 months',
                        })

        # --- Forecast all categories by branch ---
        categories = _fetch_categories()

        for cat_row in (categories or []):
            category = cat_row['category']

            for branch_row in branches:
                branch_id = branch_row['branch_id']

                daily_data = _fetch_category_daily_sales(category, branch_id)
                forecast_df = _run_prophet_forecast(daily_data, holidays_df)

                if forecast_df is not None and not forecast_df.empty:
                    category_count += 1
                    for _, row in forecast_df.iterrows():
                        all_forecasts.append({
                            'product_id': None,
                            'category': category,
                            'branch_id': branch_id,
                            'forecast_date': row['ds'].strftime('%Y-%m-%d'),
                            'predicted_quantity': round(float(row['yhat']), 2),
                            'lower_bound': round(float(row['yhat_lower']), 2),
                            'upper_bound': round(float(row['yhat_upper']), 2),
                            'based_on_period': '6 months',
                        })

        # Write all forecasts to database
        _upsert_forecasts(all_forecasts)

        return {
            'summary': (
                f"Generated 30-day demand forecasts: "
                f"{product_count} product-branch combinations, "
                f"{category_count} category-branch combinations "
                f"({len(all_forecasts)} total forecast rows)"
            ),
            'product_forecasts': product_count,
            'category_forecasts': category_count,
            'total_rows': len(all_forecasts),
        }

    except Exception as e:
        return {
            'summary': f"Demand forecasting failed: {str(e)}",
            'error': str(e),
        }
