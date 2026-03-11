import os
import psycopg2
import psycopg2.extras


def get_connection():
    """Create a new database connection using DATABASE_URL env var."""
    return psycopg2.connect(os.environ['DATABASE_URL'])


def execute_query(query, params=None):
    """Execute a SELECT query and return all rows as list of dicts."""
    conn = get_connection()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(query, params)
            return cur.fetchall()
    finally:
        conn.close()


def execute_write(query, params=None):
    """Execute a single INSERT/UPDATE/DELETE with commit."""
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(query, params)
            conn.commit()
    finally:
        conn.close()


def execute_many(query, data):
    """Execute a bulk INSERT using execute_values for performance."""
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            psycopg2.extras.execute_values(cur, query, data)
            conn.commit()
    finally:
        conn.close()


# ---------------------------------------------------------------------------
# AR / collections helper queries
# ---------------------------------------------------------------------------

def get_customers():
    """Return all active customers."""
    return execute_query("SELECT * FROM customers_col WHERE status = 'active'")


def get_invoices():
    """Return all invoices with customer info."""
    return execute_query("""
        SELECT i.*, c.name AS customer_name
        FROM invoices_col i
        JOIN customers_col c ON i.customer_id = c.customer_id
    """)


def get_incoming_payments():
    """Return all incoming payments with linked invoice info."""
    return execute_query("""
        SELECT ip.*, i.amount AS invoice_amount, i.due_date, i.issue_date,
               i.customer_id
        FROM incoming_payments_col ip
        JOIN invoices_col i ON ip.invoice_id = i.invoice_id
    """)


# ---------------------------------------------------------------------------
# AP helper queries
# ---------------------------------------------------------------------------

def get_suppliers():
    """Return all active suppliers."""
    return execute_query("SELECT * FROM suppliers_col WHERE status = 'active'")


def get_supplier_invoices():
    """Return all supplier invoices with supplier info."""
    return execute_query("""
        SELECT si.*, s.name AS supplier_name
        FROM supplier_invoices_col si
        JOIN suppliers_col s ON si.supplier_id = s.supplier_id
    """)


def get_outgoing_payments():
    """Return all outgoing payments with linked supplier invoice info."""
    return execute_query("""
        SELECT op.*, si.amount AS invoice_amount, si.due_date, si.issue_date,
               si.supplier_id
        FROM outgoing_payments_col op
        JOIN supplier_invoices_col si ON op.supplier_invoice_id = si.supplier_invoice_id
    """)


# ---------------------------------------------------------------------------
# ML result upsert helpers
# ---------------------------------------------------------------------------

def upsert_payer_segments(rows):
    """
    Bulk-replace payer_segments table.

    Each row: (customer_id, segment_name, regularity_score, amount_score,
               timeliness_score, cluster_id)
    """
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM payer_segments_col")
            psycopg2.extras.execute_values(
                cur,
                """
                INSERT INTO payer_segments_col
                    (customer_id, segment_name, regularity_score, amount_score,
                     timeliness_score, cluster_id, updated_at)
                VALUES %s
                """,
                rows,
                template="(%s, %s, %s, %s, %s, %s, NOW())"
            )
            conn.commit()
    finally:
        conn.close()


def upsert_delinquency_scores(rows):
    """
    Bulk-replace delinquency_scores table.

    Each row: (customer_id, score, risk_bucket, avg_days_overdue,
               missed_payment_count, payment_trend, outstanding_balance_ratio,
               top_risk_factor)
    """
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM delinquency_scores_col")
            psycopg2.extras.execute_values(
                cur,
                """
                INSERT INTO delinquency_scores_col
                    (customer_id, score, risk_bucket, avg_days_overdue,
                     missed_payment_count, payment_trend, outstanding_balance_ratio,
                     top_risk_factor, updated_at)
                VALUES %s
                """,
                rows,
                template="(%s, %s, %s, %s, %s, %s, %s, %s, NOW())"
            )
            conn.commit()
    finally:
        conn.close()


def upsert_credit_risk_scores(rows):
    """
    Bulk-replace credit_risk_scores table.

    Each row: (customer_id, risk_score, risk_level, outstanding_balance,
               credit_utilization, avg_days_overdue, payment_trend, top_risk_factor)
    """
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM credit_risk_scores_col")
            psycopg2.extras.execute_values(
                cur,
                """
                INSERT INTO credit_risk_scores_col
                    (customer_id, risk_score, risk_level, outstanding_balance,
                     credit_utilization, avg_days_overdue, payment_trend,
                     top_risk_factor, updated_at)
                VALUES %s
                """,
                rows,
                template="(%s, %s, %s, %s, %s, %s, %s, %s, NOW())"
            )
            conn.commit()
    finally:
        conn.close()


def upsert_payment_patterns(rows):
    """
    Bulk-replace payment_patterns table.

    Each row: (customer_id, avg_days_to_pay, preferred_method,
               typical_payment_day, partial_payment_rate)
    """
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM payment_patterns_col")
            psycopg2.extras.execute_values(
                cur,
                """
                INSERT INTO payment_patterns_col
                    (customer_id, avg_days_to_pay, preferred_method,
                     typical_payment_day, partial_payment_rate, updated_at)
                VALUES %s
                """,
                rows,
                template="(%s, %s, %s, %s, %s, NOW())"
            )
            conn.commit()
    finally:
        conn.close()


def upsert_cash_flow_forecasts(rows):
    """
    Bulk-replace cash_flow_forecasts table.

    Each row: (forecast_month, inflow_forecast, inflow_lower, inflow_upper,
               outflow_forecast, outflow_lower, outflow_upper, based_on_months)
    """
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM cash_flow_forecasts_col")
            psycopg2.extras.execute_values(
                cur,
                """
                INSERT INTO cash_flow_forecasts_col
                    (forecast_month, inflow_forecast, inflow_lower, inflow_upper,
                     outflow_forecast, outflow_lower, outflow_upper,
                     based_on_months, updated_at)
                VALUES %s
                """,
                rows,
                template="(%s, %s, %s, %s, %s, %s, %s, %s, NOW())"
            )
            conn.commit()
    finally:
        conn.close()
