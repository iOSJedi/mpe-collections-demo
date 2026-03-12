import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth-middleware'
import { runLocalPipeline, ALL_TASKS } from '@/lib/ml-local'

export async function POST(request: NextRequest) {
  // Allow via CRON_SECRET or via Firebase auth token
  const cronSecret = process.env.CRON_SECRET
  const authHeader = request.headers.get('authorization')

  if (cronSecret && authHeader === `Bearer ${cronSecret}`) {
    // Cron access — OK
  } else {
    // Fall back to Firebase auth
    const user = await verifyToken(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  try {
    const body = await request.json().catch(() => ({}))
    const tasks = (body as { tasks?: string[] }).tasks ?? ALL_TASKS

    const result = await runLocalPipeline(tasks)

    return NextResponse.json({
      success: true,
      ...result,
    })
  } catch (error) {
    console.error('ML cron failed:', error)
    return NextResponse.json(
      { error: 'Failed to run ML pipeline', details: String(error) },
      { status: 500 }
    )
  }
}
