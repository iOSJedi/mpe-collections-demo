import { NextRequest, NextResponse } from 'next/server'
import { classifyAtc } from '@/lib/cwt/classifier'
import { withAuth, AuthenticatedUser } from '@/lib/auth-middleware'

export const POST = withAuth(async (req: NextRequest, _user: AuthenticatedUser) => {
  const body = await req.json()
  const result = await classifyAtc(body)
  return NextResponse.json(result)
})
