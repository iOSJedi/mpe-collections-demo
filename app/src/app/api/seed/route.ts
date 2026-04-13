import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth-middleware'
import { seedDatabase, seedStage1, seedStage2, seedStage3, seedStage4, seedStage5 } from '@/lib/seed'
import { clearCache } from '@/lib/cache'

export const maxDuration = 300

const STAGE_FNS: Record<number, () => Promise<void>> = {
  1: seedStage1,
  2: seedStage2,
  3: seedStage3,
  4: seedStage4,
  5: seedStage5,
}

export const POST = withAuth(async (request: NextRequest) => {
  try {
    let stage: number | undefined
    try {
      const body = await request.json()
      if (body && typeof body.stage === 'number') {
        stage = body.stage
      }
    } catch {
      // No body or not JSON — run all stages
    }

    if (stage !== undefined) {
      const stageFn = STAGE_FNS[stage]
      if (!stageFn) {
        return NextResponse.json({ error: `Invalid stage: ${stage}. Must be 1–5.` }, { status: 400 })
      }
      await stageFn()
      clearCache()
      return NextResponse.json({ success: true, stage, message: `Stage ${stage} complete` })
    }

    // No stage provided — run all stages (backwards compat)
    await seedDatabase()
    clearCache()
    return NextResponse.json({ success: true })
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error)
    console.error('Seed failed:', errMsg)
    return NextResponse.json({ error: `Seed failed: ${errMsg}` }, { status: 500 })
  }
})
