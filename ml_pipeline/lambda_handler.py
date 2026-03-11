import json
from ml_pipeline.basket_analysis import run_basket_analysis
from ml_pipeline.segmentation import run_segmentation
from ml_pipeline.churn_scoring import run_churn_scoring
from ml_pipeline.credit_risk import run_credit_risk_scoring
from ml_pipeline.demand_forecast import run_demand_forecast


def handler(event, context):
    """
    AWS Lambda handler for the Ayala Land Collections ML pipeline.

    Event format:
    {
        "tasks": ["payment_patterns", "payer_segmentation", "delinquency_scoring",
                  "credit_risk", "cash_flow_forecast"],
        "run_all": false,
        "params": {
            "date_from": "2025-01-01",   # optional filter
            "date_to":   "2025-06-30"    # optional filter
        }
    }

    Task name mapping:
      payer_segmentation  → run_segmentation         (segmentation.py)
      delinquency_scoring → run_churn_scoring         (churn_scoring.py)
      credit_risk         → run_credit_risk_scoring   (credit_risk.py)
      payment_patterns    → run_basket_analysis       (basket_analysis.py)
      cash_flow_forecast  → run_demand_forecast       (demand_forecast.py)
    """
    tasks = event.get('tasks', [])
    run_all = event.get('run_all', False)
    params = event.get('params', {})

    results = {}

    if run_all or 'payment_patterns' in tasks:
        results['payment_patterns'] = run_basket_analysis(params)

    if run_all or 'payer_segmentation' in tasks:
        results['payer_segmentation'] = run_segmentation(params)

    if run_all or 'delinquency_scoring' in tasks:
        results['delinquency_scoring'] = run_churn_scoring(params)

    if run_all or 'credit_risk' in tasks:
        results['credit_risk'] = run_credit_risk_scoring(params)

    if run_all or 'cash_flow_forecast' in tasks:
        results['cash_flow_forecast'] = run_demand_forecast(params)

    return {
        'statusCode': 200,
        'body': json.dumps({
            'tasks_completed': list(results.keys()),
            'summary': {k: v.get('summary', '') for k, v in results.items()}
        })
    }
