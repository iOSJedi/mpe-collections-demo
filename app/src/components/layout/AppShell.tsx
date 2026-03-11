'use client'

import { TopBar } from './TopBar'
import { Sidebar } from './Sidebar'
import { BottomBar } from './BottomBar'
import { CustomerEmulator } from '@/components/emulator/CustomerEmulator'

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-screen flex flex-col bg-background">
      <TopBar />
      <div className="flex-1 flex overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
      <BottomBar />
      <CustomerEmulator />
    </div>
  )
}
