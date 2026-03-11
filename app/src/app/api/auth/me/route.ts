import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth-middleware'

export const GET = withAuth(async (_request: NextRequest, user) => {
  return NextResponse.json({
    user: {
      uid: user.uid,
      username: user.name || user.email || 'User',
      profilePic: user.picture || '',
    },
  })
})
