import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth-middleware'

export async function POST(request: NextRequest) {
  const user = await verifyToken(request)

  if (!user) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
  }

  return NextResponse.json({
    user: {
      uid: user.uid,
      username: user.name || user.email || 'User',
      profilePic: user.picture || '',
    },
  })
}
