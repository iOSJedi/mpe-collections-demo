'use client'
import { useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { LoginPage } from '@/components/auth/LoginPage'
import { AppShell } from '@/components/layout/AppShell'
import { PageLoadingSpinner } from '@/components/ui/page-loading-spinner'
import { useAppDispatch } from '@/store'
import { navigate } from '@/store/slices/navSlice'
import { IncomingPayments } from '@/components/receivable/IncomingPayments'

export default function IncomingPaymentsPage() {
  const { user, loading } = useAuth()
  const dispatch = useAppDispatch()

  useEffect(() => {
    dispatch(navigate({ space: 'receivable', page: 'incoming-payments' }))
  }, [dispatch])

  if (loading) return <PageLoadingSpinner message="Loading..." />
  if (!user) return <LoginPage />

  return (
    <AppShell>
      <div className="p-6 space-y-6">
        <h1 className="text-2xl font-bold text-primary">Incoming Payments</h1>
        <IncomingPayments />
      </div>
    </AppShell>
  )
}
