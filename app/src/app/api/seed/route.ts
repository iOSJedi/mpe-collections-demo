import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth-middleware'
import { exec } from 'child_process'

export const maxDuration = 60

export const POST = withAuth(async (_request: NextRequest) => {
  try {
    const result = await new Promise<string>((resolve, reject) => {
      exec(
        'npx tsx scripts/seed.ts',
        { cwd: process.cwd(), timeout: 55_000 },
        (error, stdout, stderr) => {
          if (error) {
            reject(new Error(stderr || error.message))
          } else {
            resolve(stdout)
          }
        }
      )
    })

    return NextResponse.json({ success: true, output: result })
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error)
    console.error('Seed failed:', errMsg)
    return NextResponse.json({ error: `Seed failed: ${errMsg}` }, { status: 500 })
  }
})
