'use client'

import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { LogOut } from 'lucide-react'

export function TopBar() {
  const { user, signOut } = useAuth()

  return (
    <header className="h-14 border-b border-border bg-white flex items-center justify-between px-4 shrink-0">
      <div className="flex flex-col justify-center">
        <span className="font-bold text-sm leading-tight" style={{ color: '#C5A930' }}>
          AYALA LAND
        </span>
        <span className="text-xs text-muted-foreground leading-tight">
          Collections &amp; Payments Portal
        </span>
      </div>
      <div className="flex items-center gap-3">
        {user && (
          <>
            {user.profilePic && (
              <img src={user.profilePic} alt="" className="w-8 h-8 rounded-full" />
            )}
            <span className="text-sm text-muted-foreground">{user.username}</span>
            <Button variant="ghost" size="icon" onClick={signOut} title="Sign out">
              <LogOut className="w-4 h-4" />
            </Button>
          </>
        )}
      </div>
    </header>
  )
}
