import { NextRequest, NextResponse } from 'next/server'
import { saveCoords, type CoordMap } from '@/lib/cwt/pdf-coords'

export async function POST(req: NextRequest) {
  const { coords }: { coords: CoordMap } = await req.json()
  if (!coords || typeof coords !== 'object') {
    return NextResponse.json({ error: 'coords payload required' }, { status: 400 })
  }
  await saveCoords(coords)
  return NextResponse.json({ ok: true, fields: Object.keys(coords).length })
}
