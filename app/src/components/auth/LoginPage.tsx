'use client'

import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Loader2 } from 'lucide-react'

export function LoginPage() {
  const { signInWithGoogle, loading, error } = useAuth()

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-full max-w-sm space-y-6 text-center">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold text-foreground">
            Data Intelligence System
          </h1>
          <p className="text-sm text-muted-foreground">
            Sign in to access the analytics dashboard
          </p>
        </div>
        <Button
          onClick={signInWithGoogle}
          disabled={loading}
          className="w-full"
          size="lg"
        >
          {loading ? (
            <Loader2 className="animate-spin" />
          ) : (
            'Sign in with Google'
          )}
        </Button>
        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}
      </div>
    </div>
  )
}
