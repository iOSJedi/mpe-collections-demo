"""
Basket Analysis using FP-Growth algorithm.

Finds product associations (frequently bought together) by analyzing
transaction baskets. Runs separately for retail and wholesale transactions.
Uses mlxtend's FP-Growth for frequent itemset mining and association rule generation.
"""

import pandas as pd
from mlxtend.frequent_patterns import fpgrowth
from mlxtend.frequent_patterns import association_rules
from .db import get_connection, execute_query
import psycopg2.extras


def _build_basket_query(transaction_type, params):
    """Build SQL query to fetch transaction baskets."""
    conditions = ["t.transaction_type = %s"]
    query_params = [transaction_type]

    if params.get('branch_id'):
        conditions.append("t.branch_id = %s")
        query_params.append(params['branch_id'])

    if params.get('date_from'):
        conditions.append("t.transaction_date >= %s")
        query_params.append(params['date_from'])

    if params.get('date_to'):
        conditions.append("t.transaction_date <= %s")
        query_params.append(params['date_to'])

    where_clause = " AND ".join(conditions)

    query = f"""
        SELECT
            t.transaction_id,
            ti.product_id
        FROM transactions t
        JOIN transaction_items ti ON t.transaction_id = ti.transaction_id
        WHERE {where_clause}
    """
    return query, query_params


def _run_fpgrowth_for_type(transaction_type, params):
    """Run FP-Growth analysis for a specific transaction type."""
    query, query_params = _build_basket_query(transaction_type, params)
    rows = execute_query(query, query_params)

    if not rows or len(rows) < 10:
        return [], 0

    df = pd.DataFrame(rows)

    # Create basket matrix: rows=transactions, columns=products, values=True/False
    basket = df.groupby(['transaction_id', 'product_id']).size().unstack(fill_value=0)
    basket = basket.applymap(lambda x: True if x > 0 else False)

    num_baskets = len(basket)

    # Need at least 50 baskets and 2 products for meaningful analysis
    if num_baskets < 50 or basket.shape[1] < 2:
        return [], num_baskets

    # Adjust min_support based on basket count — smaller datasets need higher support
    min_support = 0.02
    if num_baskets < 200:
        min_support = 0.05
    elif num_baskets < 500:
        min_support = 0.03

    try:
        frequent_itemsets = fpgrowth(basket, min_support=min_support, use_colnames=True)
    except Exception:
        return [], num_baskets

    if frequent_itemsets.empty:
        return [], num_baskets

    # Filter to only pairs (2-itemsets)
    frequent_itemsets = frequent_itemsets[
        frequent_itemsets['itemsets'].apply(lambda x: len(x) == 2)
    ]

    if frequent_itemsets.empty:
        return [], num_baskets

    try:
        rules = association_rules(
            frequent_itemsets,
            metric="lift",
            min_threshold=1.5,
            num_itemsets=len(basket)
        )
    except Exception:
        return [], num_baskets

    # Filter by confidence
    rules = rules[rules['confidence'] >= 0.25]

    if rules.empty:
        return [], num_baskets

    # Build association records
    associations = []
    seen_pairs = set()

    for _, rule in rules.iterrows():
        antecedent = list(rule['antecedents'])
        consequent = list(rule['consequents'])

        # Only handle single-item antecedent -> single-item consequent
        if len(antecedent) != 1 or len(consequent) != 1:
            continue

        product_a = antecedent[0]
        product_b = consequent[0]

        # Normalize pair ordering to avoid duplicates
        pair_key = tuple(sorted([product_a, product_b]))
        if pair_key in seen_pairs:
            # Update confidence for B->A direction
            for assoc in associations:
                if (assoc['product_a_id'] == pair_key[0] and
                        assoc['product_b_id'] == pair_key[1]):
                    # Determine which direction this rule represents
                    if product_a == pair_key[0]:
                        assoc['confidence_a_to_b'] = float(rule['confidence'])
                    else:
                        assoc['confidence_b_to_a'] = float(rule['confidence'])
                    break
            continue

        seen_pairs.add(pair_key)

        # Determine direction-specific confidence values
        if product_a == pair_key[0]:
            conf_a_to_b = float(rule['confidence'])
            conf_b_to_a = 0.0
        else:
            conf_a_to_b = 0.0
            conf_b_to_a = float(rule['confidence'])

        associations.append({
            'product_a_id': pair_key[0],
            'product_b_id': pair_key[1],
            'support': float(rule['support']),
            'confidence_a_to_b': conf_a_to_b,
            'confidence_b_to_a': conf_b_to_a,
            'lift': float(rule['lift']),
            'transaction_type': transaction_type,
            'branch_id': params.get('branch_id'),
        })

    return associations, num_baskets


def _upsert_associations(associations):
    """Delete existing associations for the same scope and insert new ones."""
    if not associations:
        return

    conn = get_connection()
    try:
        with conn.cursor() as cur:
            # Group by transaction_type + branch_id and delete existing
            scopes = set()
            for a in associations:
                scopes.add((a['transaction_type'], a['branch_id']))

            for txn_type, branch_id in scopes:
                if branch_id:
                    cur.execute(
                        "DELETE FROM product_associations WHERE transaction_type = %s AND branch_id = %s",
                        (txn_type, branch_id)
                    )
                else:
                    cur.execute(
                        "DELETE FROM product_associations WHERE transaction_type = %s AND branch_id IS NULL",
                        (txn_type,)
                    )

            # Bulk insert new associations
            values = [
                (
                    a['product_a_id'], a['product_b_id'], a['support'],
                    a['confidence_a_to_b'], a['confidence_b_to_a'], a['lift'],
                    a['transaction_type'], a['branch_id']
                )
                for a in associations
            ]

            psycopg2.extras.execute_values(
                cur,
                """
                INSERT INTO product_associations
                    (product_a_id, product_b_id, support, confidence_a_to_b,
                     confidence_b_to_a, lift, transaction_type, branch_id, updated_at)
                VALUES %s
                """,
                values,
                template="(%s, %s, %s, %s, %s, %s, %s, %s, NOW())"
            )

            conn.commit()
    finally:
        conn.close()


def run_basket_analysis(params):
    """
    Run FP-Growth basket analysis for both retail and wholesale transactions.

    Args:
        params: dict with optional keys: branch_id, date_from, date_to

    Returns:
        dict with 'summary' key describing results
    """
    try:
        all_associations = []
        total_baskets = 0

        for txn_type in ['retail', 'wholesale']:
            associations, num_baskets = _run_fpgrowth_for_type(txn_type, params)
            all_associations.extend(associations)
            total_baskets += num_baskets

        _upsert_associations(all_associations)

        return {
            'summary': (
                f"Found {len(all_associations)} significant product associations "
                f"for {total_baskets} baskets"
            ),
            'association_count': len(all_associations),
            'basket_count': total_baskets,
        }

    except Exception as e:
        return {
            'summary': f"Basket analysis failed: {str(e)}",
            'error': str(e),
        }
