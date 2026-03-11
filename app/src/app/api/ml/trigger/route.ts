import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth-middleware'

const isLambdaConfigured = !!process.env.LAMBDA_URL

export const POST = withAuth(async (request: NextRequest) => {
  try {
    const body = await request.json()
    const { tasks, params } = body as {
      tasks: string[]
      params?: Record<string, unknown>
    }

    if (!tasks || !Array.isArray(tasks) || tasks.length === 0) {
      return NextResponse.json(
        { error: 'tasks array is required' },
        { status: 400 }
      )
    }

    if (isLambdaConfigured) {
      const { invokeLambda } = await import('@/lib/lambda')
      const result = await invokeLambda({ tasks, params })
      return NextResponse.json(result)
    }

    // Mock response for demo when Lambda is not configured
    const mockSummaries: Record<string, string> = {
      basket_analysis: 'Found 47 significant product associations',
      customer_segmentation:
        'Segmented 1,248 customers into 5 clusters: Champions (18%), Loyal (24%), At Risk (15%), New (28%), Lost (15%)',
      churn_risk:
        'Scored 1,248 customers — 89 flagged as high/critical churn risk',
      credit_risk:
        'Updated credit risk for 312 wholesale buyers — 14 flagged as high risk',
      demand_forecast:
        'Generated 30-day forecasts for 156 product categories across 7 branches',
    }

    const completedTasks = tasks.filter((t) => mockSummaries[t])
    const summary: Record<string, string> = {}
    for (const t of completedTasks) {
      summary[t] = mockSummaries[t]
    }

    return NextResponse.json({
      statusCode: 200,
      body: {
        tasks_completed: completedTasks,
        summary,
      },
    })
  } catch (error) {
    console.error('ML trigger failed:', error)
    return NextResponse.json(
      { error: 'Failed to trigger ML analysis' },
      { status: 500 }
    )
  }
})
