'use client'

import { LayoutDashboard, MessageSquare, Users, Store, GitBranch, FlaskConical } from 'lucide-react'
import { useAppDispatch, useAppSelector } from '@/store'
import { setActiveView } from '@/store/slices/navSlice'
import { NavView } from '@/types'
import { cn } from '@/lib/utils'
import { useRouter } from 'next/navigation'

const navItems: { view: NavView; icon: typeof LayoutDashboard; label: string; href: string }[] = [
  { view: 'dashboard', icon: LayoutDashboard, label: 'Dashboard', href: '/' },
  { view: 'chat', icon: MessageSquare, label: 'Chat', href: '/chat' },
  { view: 'customers', icon: Users, label: 'Customers', href: '/customers' },
  { view: 'wholesale', icon: Store, label: 'Wholesale', href: '/wholesale' },
  { view: 'branches', icon: GitBranch, label: 'Branches', href: '/branches' },
  { view: 'analytics', icon: FlaskConical, label: 'Analytics', href: '/analytics' },
]

export function Sidebar() {
  const dispatch = useAppDispatch()
  const activeView = useAppSelector(s => s.nav.activeView)
  const router = useRouter()

  return (
    <nav className="w-16 border-r border-border bg-white flex flex-col items-center pt-4 gap-1">
      {navItems.map(({ view, icon: Icon, label, href }) => (
        <button
          key={view}
          onClick={() => {
            dispatch(setActiveView(view))
            router.push(href)
          }}
          className={cn(
            'w-12 h-12 flex flex-col items-center justify-center rounded-lg text-xs gap-0.5 transition-colors',
            activeView === view
              ? 'bg-secondary/10 text-secondary font-medium'
              : 'text-muted-foreground hover:bg-muted'
          )}
        >
          <Icon className="w-5 h-5" />
          <span>{label}</span>
        </button>
      ))}
    </nav>
  )
}
