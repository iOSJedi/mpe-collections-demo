import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { penaltyConfig } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { withAuth } from '@/lib/auth-middleware'
import { cachedJson, getFromCache, setInCache } from '@/lib/cache'

// GET /api/penalty-config
export const GET = withAuth(async () => {
  const cacheKey = 'penalty-config'
  const cached = getFromCache(cacheKey)
  if (cached) return cachedJson(cached, 60, 120)

  const rows = await db.select().from(penaltyConfig).limit(1)
  if (!rows.length) {
    const defaultConfig = {
      configId: 0,
      penaltyRatePercent: 2.0,
      penaltyFrequency: 'MONTHLY',
      applicationMethod: 'PENALTIES_FIRST',
      gracePeriodDays: 0,
    }
    setInCache(cacheKey, defaultConfig, 60_000)
    return cachedJson(defaultConfig, 60, 120)
  }
  const c = rows[0]
  const result = {
    configId: c.configId,
    penaltyRatePercent: Number(c.penaltyRatePercent),
    penaltyFrequency: c.penaltyFrequency,
    applicationMethod: c.applicationMethod,
    gracePeriodDays: c.gracePeriodDays,
  }
  setInCache(cacheKey, result, 60_000)
  return cachedJson(result, 60, 120)
})

// PUT /api/penalty-config
export const PUT = withAuth(async (request: NextRequest) => {
  const body = await request.json()
  const { penaltyRatePercent, applicationMethod, gracePeriodDays } = body

  const rows = await db.select().from(penaltyConfig).limit(1)
  if (rows.length) {
    await db.update(penaltyConfig)
      .set({
        penaltyRatePercent: String(penaltyRatePercent),
        applicationMethod,
        gracePeriodDays,
        updatedAt: new Date(),
      })
      .where(eq(penaltyConfig.configId, rows[0].configId))
  } else {
    await db.insert(penaltyConfig).values({
      penaltyRatePercent: String(penaltyRatePercent),
      applicationMethod,
      gracePeriodDays,
    })
  }

  return NextResponse.json({ success: true })
})
