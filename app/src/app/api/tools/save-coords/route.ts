import { NextRequest, NextResponse } from 'next/server'
import { writeFile } from 'node:fs/promises'
import path from 'node:path'
import type { FieldCoord } from '@/lib/cwt/pdf-coords'

// Dev-only: writes updated coords to src/lib/cwt/pdf-coords.ts.
// In Vercel production the filesystem is read-only, so this will 500 — use locally.
export async function POST(req: NextRequest) {
  if (process.env.VERCEL === '1') {
    return NextResponse.json(
      { error: 'save is disabled in serverless prod — run `npm run dev` locally and try again' },
      { status: 400 }
    )
  }

  const { coords }: { coords: Record<string, FieldCoord> } = await req.json()

  const entries = Object.entries(coords)
    .map(([k, c]) => {
      const parts = [`x: ${c.x}`, `y: ${c.y}`]
      if (c.size !== undefined) parts.push(`size: ${c.size}`)
      if (c.bold === false) parts.push('bold: false')
      parts.push(`label: ${JSON.stringify(c.label)}`)
      return `  ${k}: { ${parts.join(', ')} },`
    })
    .join('\n')

  const source = `// Coordinates for overlaying data onto app/public/forms/BIR-2307-real.pdf.
// Values are in PDF points using TOP-LEFT origin (same as pymupdf extraction).
// pdf-lib draws from bottom-left, so at render time: y_lib = 936 - y.
// Tune these in the visual editor at /tools/bir-overlay.

export const PDF_SIZE = { width: 612, height: 936 }
export const BG_PNG = '/forms/BIR-2307-bg.png'  // rendered at 2.5× (1530×2340)
export const BG_SCALE = 2.5

export interface FieldCoord { x: number; y: number; size?: number; bold?: boolean; label: string }

export const COORDS: Record<string, FieldCoord> = {
${entries}
}

export type CoordKey = keyof typeof COORDS
`
  const target = path.resolve(process.cwd(), 'src/lib/cwt/pdf-coords.ts')
  await writeFile(target, source, 'utf8')
  return NextResponse.json({ ok: true, path: target })
}
