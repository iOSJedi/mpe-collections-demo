'use client'
import { useAuth } from '@/contexts/AuthContext'
import { LoginPage } from '@/components/auth/LoginPage'
import { AppShell } from '@/components/layout/AppShell'
import { PageLoadingSpinner } from '@/components/ui/page-loading-spinner'
import { useAppDispatch } from '@/store'
import { setActiveView } from '@/store/slices/navSlice'
import { useEffect } from 'react'
import { CustomerList } from '@/components/customers/CustomerList'

export default function CustomersPage() {
  const { user, loading } = useAuth()
  const dispatch = useAppDispatch()
  useEffect(() => { dispatch(setActiveView('customers')) }, [dispatch])

  if (loading) return <PageLoadingSpinner message="Loading customers..." />
  if (!user) return <LoginPage />

  return (
    <AppShell>
      <CustomerList />
    </AppShell>
  )
}
