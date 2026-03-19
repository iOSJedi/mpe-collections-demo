'use client'
import { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { LoginPage } from '@/components/auth/LoginPage'
import { AppShell } from '@/components/layout/AppShell'
import { PageLoadingSpinner } from '@/components/ui/page-loading-spinner'
import { useAppDispatch } from '@/store'
import { navigate } from '@/store/slices/navSlice'
import { SupplierList } from '@/components/payable/SupplierList'
import { ApprovalQueue } from '@/components/payable/ApprovalQueue'

type PageTab = 'suppliers' | 'approval-queue'

const TABS: { key: PageTab; label: string }[] = [
  { key: 'suppliers', label: 'Suppliers' },
  { key: 'approval-queue', label: 'Approval Queue' },
]

export default function PayablePage() {
  const { user, loading } = useAuth()
  const dispatch = useAppDispatch()
  const [activeTab, setActiveTab] = useState<PageTab>('suppliers')

  useEffect(() => {
    dispatch(navigate({ space: 'payable', page: 'supplier-accounts' }))
  }, [dispatch])

  if (loading) return <PageLoadingSpinner message="Loading..." />
  if (!user) return <LoginPage />

  return (
    <AppShell>
      <div className="p-6 space-y-6">
        <h1 className="text-2xl font-bold text-primary">Accounts Payable</h1>

        {/* Page-level tabs */}
        <div className="flex border-b border-slate-200 gap-0">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-5 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
                activeTab === tab.key
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'suppliers' && <SupplierList />}
        {activeTab === 'approval-queue' && <ApprovalQueue />}
      </div>
    </AppShell>
  )
}
