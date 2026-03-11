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
