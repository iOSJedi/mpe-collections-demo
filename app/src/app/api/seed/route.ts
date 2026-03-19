import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth-middleware'
import { seedDatabase } from '@/lib/seed'

export const maxDuration = 300

export const POST = withAuth(async (_request: NextRequest) => {
  try {
    await seedDatabase()
    return NextResponse.json({ success: true })
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error)
    console.error('Seed failed:', errMsg)
    return NextResponse.json({ error: `Seed failed: ${errMsg}` }, { status: 500 })
  }
})
