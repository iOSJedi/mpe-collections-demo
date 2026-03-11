'use client'

import { useState, useEffect } from 'react'
import {
  LayoutDashboard,
  ArrowDownToLine,
  ArrowUpFromLine,
  ClipboardList,
  Brain,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  Menu,
  Settings,
  DatabaseZap,
  Loader2,
  X,
} from 'lucide-react'
import { apiFetch } from '@/lib/api'
import { useRouter } from 'next/navigation'
import { useAppDispatch, useAppSelector } from '@/store'
import { navigate } from '@/store/slices/navSlice'
import { NavSpace, NavPage } from '@/types'
import { cn } from '@/lib/utils'
import { rtdb } from '@/lib/firebase'
import { ref, onValue, off } from 'firebase/database'

interface SubPage {
  page: NavPage
  label: string
  href: string
}

interface SpaceConfig {
  space: NavSpace
  icon: typeof LayoutDashboard
  label: string
  href?: string
  subPages?: SubPage[]
}

const spaces: SpaceConfig[] = [
  {
    space: 'overview',
    icon: LayoutDashboard,
    label: 'Overview',
    href: '/',
  },
  {
    space: 'receivable',
    icon: ArrowDownToLine,
    label: 'Accounts Receivable',
    subPages: [
      { page: 'customer-accounts', label: 'Customer Accounts', href: '/receivable' },
      { page: 'incoming-payments', label: 'Incoming Payments', href: '/receivable/payments' },
    ],
  },
  {
    space: 'payable',
    icon: ArrowUpFromLine,
    label: 'Accounts Payable',
    subPages: [
      { page: 'supplier-accounts', label: 'Supplier Accounts', href: '/payable' },
      { page: 'gr-ir-reconciliation', label: 'GR/IR Reconciliation', href: '/payable/matching' },
    ],
  },
  {
    space: 'collections',
    icon: ClipboardList,
    label: 'Collections Mgmt',
    subPages: [
      { page: 'collections-worklist', label: 'Collections Worklist', href: '/collections' },
      { page: 'document-verification', label: 'Document Verification', href: '/collections/documents' },
      { page: 'escalation-queue', label: 'Escalation Queue', href: '/collections/escalations' },
    ],
  },
  {
    space: 'intelligence',
    icon: Brain,
    label: 'Intelligence',
    subPages: [
      { page: 'ai-assistant', label: 'AI Assistant', href: '/intelligence' },
      { page: 'insights-scoring', label: 'Insights & Scoring', href: '/intelligence/insights' },
      { page: 'analytics', label: 'Analytics', href: '/intelligence/analytics' },
    ],
  },
]

export function Sidebar() {
  const dispatch = useAppDispatch()
  const router = useRouter()
  const activeSpace = useAppSelector(s => s.nav.activeSpace)
  const activePage = useAppSelector(s => s.nav.activePage)

  const [collapsed, setCollapsed] = useState(false)
  const [expandedSpaces, setExpandedSpaces] = useState<Set<NavSpace>>(new Set([activeSpace]))
  const [hasOpenEscalations, setHasOpenEscalations] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [seeding, setSeeding] = useState(false)
  const [seedResult, setSeedResult] = useState<{ ok: boolean; message: string } | null>(null)

  // Subscribe to Firebase RTDB for open escalation notifications
  useEffect(() => {
    if (!rtdb) return
    const escalationsRef = ref(rtdb, 'collections/escalations')
    const handleValue = (snapshot: import('firebase/database').DataSnapshot) => {
      if (!snapshot.exists()) {
        setHasOpenEscalations(false)
        return
      }
      const data = snapshot.val() as Record<string, { status?: string }>
      const hasOpen = Object.values(data).some(e => e?.status === 'OPEN')
      setHasOpenEscalations(hasOpen)
    }
    onValue(escalationsRef, handleValue)
    return () => off(escalationsRef, 'value', handleValue)
  }, [])

  const handleSpaceClick = (spaceConfig: SpaceConfig) => {
    if (spaceConfig.href) {
      // Single-page space: navigate directly
      dispatch(navigate({ space: spaceConfig.space, page: spaceConfig.space as NavPage }))
      router.push(spaceConfig.href)
    } else {
      // Multi-page space: toggle expansion
      setExpandedSpaces(prev => {
        const next = new Set(prev)
        if (next.has(spaceConfig.space)) {
          next.delete(spaceConfig.space)
        } else {
          next.add(spaceConfig.space)
        }
        return next
      })
    }
  }

  const handlePageClick = (spaceConfig: SpaceConfig, sub: SubPage) => {
    dispatch(navigate({ space: spaceConfig.space, page: sub.page }))
    router.push(sub.href)
  }

  return (
    <nav
      className={cn(
        'flex flex-col h-full transition-all duration-200 shrink-0',
        collapsed ? 'w-14' : 'w-56'
      )}
      style={{ backgroundColor: '#003B1F', color: '#fff' }}
    >
      {/* Logo / collapse toggle */}
      <div className="flex items-center justify-between px-3 py-3 border-b border-white/10">
        {!collapsed && (
          <span className="font-bold text-sm tracking-widest" style={{ color: '#C5A930' }}>
            ALC
          </span>
        )}
        <button
          onClick={() => setCollapsed(c => !c)}
          className="ml-auto p-1 rounded hover:bg-white/10 transition-colors"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? (
            <Menu className="w-4 h-4 text-white/70" />
          ) : (
            <ChevronLeft className="w-4 h-4 text-white/70" />
          )}
        </button>
      </div>

      {/* Nav items */}
      <div className="flex-1 overflow-y-auto py-2">
        {spaces.map(spaceConfig => {
          const Icon = spaceConfig.icon
          const isActiveSpace = activeSpace === spaceConfig.space
          const isExpanded = expandedSpaces.has(spaceConfig.space)
          const hasSubPages = !!spaceConfig.subPages?.length

          return (
            <div key={spaceConfig.space}>
              {/* Space row */}
              <button
                onClick={() => handleSpaceClick(spaceConfig)}
                className={cn(
                  'w-full flex items-center gap-2 px-3 py-2.5 text-sm transition-colors relative',
                  'hover:bg-white/10',
                  isActiveSpace ? 'bg-white/10' : ''
                )}
              >
                {/* Gold left border for active space */}
                {isActiveSpace && (
                  <span
                    className="absolute left-0 top-0 bottom-0 w-0.5"
                    style={{ backgroundColor: '#C5A930' }}
                  />
                )}

                {/* Icon with optional escalation badge dot */}
                <span className="relative shrink-0">
                  <Icon
                    className="w-4 h-4"
                    style={{ color: isActiveSpace ? '#C5A930' : 'rgba(255,255,255,0.75)' }}
                  />
                  {spaceConfig.space === 'collections' && hasOpenEscalations && (
                    <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                  )}
                </span>

                {!collapsed && (
                  <>
                    <span
                      className={cn('flex-1 text-left truncate', isActiveSpace ? 'font-medium' : '')}
                      style={{ color: isActiveSpace ? '#C5A930' : 'rgba(255,255,255,0.85)' }}
                    >
                      {spaceConfig.label}
                    </span>
                    {hasSubPages && (
                      isExpanded
                        ? <ChevronDown className="w-3.5 h-3.5 text-white/50 shrink-0" />
                        : <ChevronRight className="w-3.5 h-3.5 text-white/50 shrink-0" />
                    )}
                  </>
                )}
              </button>

              {/* Sub-pages */}
              {!collapsed && hasSubPages && isExpanded && (
                <div className="pb-1">
                  {spaceConfig.subPages!.map(sub => {
                    const isActivePage = activePage === sub.page
                    return (
                      <button
                        key={sub.page}
                        onClick={() => handlePageClick(spaceConfig, sub)}
                        className={cn(
                          'w-full flex items-center pl-9 pr-3 py-2 text-xs transition-colors',
                          'hover:bg-white/10',
                          isActivePage ? 'bg-white/15 font-medium' : ''
                        )}
                        style={{
                          color: isActivePage ? '#C5A930' : 'rgba(255,255,255,0.65)',
                        }}
                      >
                        <span className="truncate">{sub.label}</span>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Settings button */}
      <div className="border-t border-white/10 px-3 py-3">
        <button
          onClick={() => setShowSettings(s => !s)}
          className={cn(
            'w-full flex items-center gap-2 px-2 py-2 text-xs rounded transition-colors',
            'hover:bg-white/10',
            showSettings ? 'bg-white/10' : ''
          )}
          style={{ color: 'rgba(255,255,255,0.65)' }}
        >
          <Settings className="w-4 h-4 shrink-0" />
          {!collapsed && <span>Settings</span>}
        </button>
      </div>

      {/* Settings panel (overlay) */}
      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowSettings(false)} />
          <div className="relative z-10 bg-white rounded-xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
              <h3 className="font-semibold text-slate-900">Settings</h3>
              <button
                onClick={() => setShowSettings(false)}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <h4 className="text-sm font-medium text-slate-700 mb-1">Demo Data</h4>
                <p className="text-xs text-slate-500 mb-3">
                  Reset all tables and re-seed with fresh synthetic data. This replaces all existing records.
                </p>
                <button
                  onClick={async () => {
                    if (seeding) return
                    setSeedResult(null)
                    setSeeding(true)
                    try {
                      const res = await apiFetch('/api/seed', { method: 'POST' })
                      if (!res.ok) {
                        const data = await res.json()
                        setSeedResult({ ok: false, message: data.error || 'Seed failed' })
                      } else {
                        setSeedResult({ ok: true, message: 'Data re-seeded successfully. Refresh the page to see new data.' })
                      }
                    } catch (err) {
                      setSeedResult({ ok: false, message: err instanceof Error ? err.message : 'Unknown error' })
                    } finally {
                      setSeeding(false)
                    }
                  }}
                  disabled={seeding}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
                  style={{ backgroundColor: '#003B1F', color: '#fff' }}
                >
                  {seeding ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Re-seeding data...
                    </>
                  ) : (
                    <>
                      <DatabaseZap className="w-4 h-4" />
                      Re-seed Demo Data
                    </>
                  )}
                </button>
              </div>
              {seedResult && (
                <div className={cn(
                  'text-xs px-3 py-2 rounded-lg border',
                  seedResult.ok
                    ? 'bg-green-50 border-green-200 text-green-700'
                    : 'bg-red-50 border-red-200 text-red-700'
                )}>
                  {seedResult.message}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </nav>
  )
}
