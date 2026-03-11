'use client'

import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { LogOut } from 'lucide-react'

export function TopBar() {
  const { user, signOut } = useAuth()

  return (
    <header className="h-14 border-b border-border bg-white flex items-center justify-between px-4">
      <h1 className="text-sm font-semibold text-primary">Data Intelligence</h1>
      <div className="flex items-center gap-3">
        {user && (
          <>
            <span className="text-sm text-muted-foreground">{user.username}</span>
            {user.profilePic && (
              <img src={user.profilePic} alt="" className="w-8 h-8 rounded-full" />
            )}
            <Button variant="ghost" size="icon" onClick={signOut}>
              <LogOut className="w-4 h-4" />
            </Button>
          </>
        )}
      </div>
    </header>
  )
}
