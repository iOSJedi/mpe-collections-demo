'use client'
import { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { LoginPage } from '@/components/auth/LoginPage'
import { AppShell } from '@/components/layout/AppShell'
import { PageLoadingSpinner } from '@/components/ui/page-loading-spinner'
import { useAppDispatch } from '@/store'
import { navigate } from '@/store/slices/navSlice'
import { Worklist } from '@/components/collections/Worklist'
import { ForfeitureQueue } from '@/components/collections/ForfeitureQueue'

type TabKey = 'worklist' | 'forfeitures'

const TABS: { key: TabKey; label: string }[] = [
  { key: 'worklist', label: 'Collections Worklist' },
  { key: 'forfeitures', label: 'Forfeitures' },
]

export default function CollectionsPage() {
  const { user, loading } = useAuth()
  const dispatch = useAppDispatch()
  const [activeTab, setActiveTab] = useState<TabKey>('worklist')

  useEffect(() => {
    dispatch(navigate({ space: 'collections', page: 'collections-worklist' }))
  }, [dispatch])

  if (loading) return <PageLoadingSpinner message="Loading..." />
  if (!user) return <LoginPage />

  return (
    <AppShell>
      <div className="p-6 space-y-6">
        <h1 className="text-2xl font-bold text-primary">Collections</h1>

        {/* Tab bar */}
        <div className="flex gap-1 border-b border-slate-200">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.key
                  ? 'border-[#003B1F] text-[#003B1F]'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'worklist' && <Worklist />}
        {activeTab === 'forfeitures' && <ForfeitureQueue />}
      </div>
    </AppShell>
  )
}
