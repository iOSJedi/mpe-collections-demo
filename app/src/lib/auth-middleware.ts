import { NextRequest, NextResponse } from 'next/server'
import { getAuth } from './firebase-admin'

export interface AuthenticatedUser {
  uid: string
  email: string | undefined
  name: string | undefined
  picture: string | undefined
}

export async function verifyToken(request: NextRequest): Promise<AuthenticatedUser | null> {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null
    }

    const auth = getAuth()
    if (!auth) {
      console.warn('Firebase Auth not initialized')
      return null
    }

    const token = authHeader.substring(7)
    const decodedToken = await auth.verifyIdToken(token)

    return {
      uid: decodedToken.uid,
      email: decodedToken.email,
      name: decodedToken.name,
      picture: decodedToken.picture,
    }
  } catch (error) {
    console.error('Token verification failed:', error)
    return null
  }
}

export function withAuth(
  handler: (request: NextRequest, user: AuthenticatedUser) => Promise<NextResponse>
) {
  return async (request: NextRequest) => {
    const user = await verifyToken(request)
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }
    return handler(request, user)
  }
}
