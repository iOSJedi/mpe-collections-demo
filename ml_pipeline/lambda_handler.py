import json
from ml_pipeline.basket_analysis import run_basket_analysis
from ml_pipeline.segmentation import run_segmentation
from ml_pipeline.churn_scoring import run_churn_scoring
from ml_pipeline.credit_risk import run_credit_risk_scoring
from ml_pipeline.demand_forecast import run_demand_forecast


def handler(event, context):
    """
    AWS Lambda handler for the Citimart ML pipeline.

    Event format:
    {
        "tasks": ["basket_analysis", "segmentation", "churn_scoring", "credit_risk", "demand_forecast"],
        "run_all": false,
        "params": {
            "branch_id": "BR001",           # optional filter
            "transaction_type": "retail",    # optional filter
            "date_from": "2025-01-01",       # optional filter
            "date_to": "2025-06-30"          # optional filter
        }
    }
    """
    tasks = event.get('tasks', [])
    run_all = event.get('run_all', False)
    params = event.get('params', {})

    results = {}

    if run_all or 'basket_analysis' in tasks:
        results['basket_analysis'] = run_basket_analysis(params)

    if run_all or 'segmentation' in tasks:
        results['segmentation'] = run_segmentation(params)

    if run_all or 'churn_scoring' in tasks:
        results['churn_scoring'] = run_churn_scoring(params)

    if run_all or 'credit_risk' in tasks:
        results['credit_risk'] = run_credit_risk_scoring(params)

    if run_all or 'demand_forecast' in tasks:
        results['demand_forecast'] = run_demand_forecast(params)

    return {
        'statusCode': 200,
        'body': json.dumps({
            'tasks_completed': list(results.keys()),
            'summary': {k: v.get('summary', '') for k, v in results.items()}
        })
    }
