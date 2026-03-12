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

    // Run analysis locally when Lambda is not configured
    const { runLocalPipeline } = await import('@/lib/ml-local')
    const result = await runLocalPipeline(tasks)

    return NextResponse.json({
      statusCode: 200,
      body: result,
    })
  } catch (error) {
    console.error('ML trigger failed:', error)
    return NextResponse.json(
      { error: 'Failed to trigger ML analysis' },
      { status: 500 }
    )
  }
})
