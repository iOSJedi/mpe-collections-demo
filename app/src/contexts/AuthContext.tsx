'use client'

import React, { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react'
import {
  signInWithGoogle as firebaseSignIn,
  signOut as firebaseSignOut,
  getIdToken,
  onAuthChange,
  FirebaseUser,
} from '@/lib/firebase'

interface AuthUser {
  uid: string
  username: string
  profilePic: string
}

interface AuthContextValue {
  user: AuthUser | null
  loading: boolean
  error: string | null
  signInWithGoogle: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const currentUidRef = React.useRef<string | null>(null)
  const initialLoadDoneRef = React.useRef(false)

  const syncWithBackend = useCallback(async (firebaseUser: FirebaseUser | null) => {
    if (!firebaseUser) {
      currentUidRef.current = null
      setUser(null)
      setLoading(false)
      initialLoadDoneRef.current = true
      return
    }

    if (initialLoadDoneRef.current && currentUidRef.current === firebaseUser.uid) {
      return
    }

    try {
      const token = await firebaseUser.getIdToken()
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })

      if (!response.ok) throw new Error('Failed to sync with backend')

      const data = await response.json()
      currentUidRef.current = firebaseUser.uid
      setUser(data.user)
      setError(null)
    } catch (err) {
      console.error('Backend sync error:', err)
      setError('Failed to authenticate with server')
      setUser(null)
      currentUidRef.current = null
    } finally {
      setLoading(false)
      initialLoadDoneRef.current = true
    }
  }, [])

  useEffect(() => {
    const unsubscribe = onAuthChange((firebaseUser) => {
      syncWithBackend(firebaseUser)
    })
    return () => unsubscribe()
  }, [syncWithBackend])

  const signInWithGoogle = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const firebaseUser = await firebaseSignIn()
      await syncWithBackend(firebaseUser)
    } catch (err) {
      console.error('Sign in error:', err)
      setError('Failed to sign in with Google')
      setLoading(false)
    }
  }, [syncWithBackend])

  const signOut = useCallback(async () => {
    setLoading(true)
    try {
      await firebaseSignOut()
      setUser(null)
      setError(null)
    } catch (err) {
      console.error('Sign out error:', err)
      setError('Failed to sign out')
    } finally {
      setLoading(false)
    }
  }, [])

  return (
    <AuthContext.Provider value={{ user, loading, error, signInWithGoogle, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within an AuthProvider')
  return context
}
