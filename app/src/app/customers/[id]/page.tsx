'use client'
import { useAuth } from '@/contexts/AuthContext'
import { LoginPage } from '@/components/auth/LoginPage'
import { AppShell } from '@/components/layout/AppShell'
import { PageLoadingSpinner } from '@/components/ui/page-loading-spinner'
import { useAppDispatch } from '@/store'
import { setActiveView } from '@/store/slices/navSlice'
import { useEffect, use } from 'react'
import { CustomerDNA } from '@/components/customers/CustomerDNA'

export default function CustomerProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { user, loading } = useAuth()
  const dispatch = useAppDispatch()
  useEffect(() => { dispatch(setActiveView('customers')) }, [dispatch])

  if (loading) return <PageLoadingSpinner message="Loading customer profile..." />
  if (!user) return <LoginPage />

  return (
    <AppShell>
      <CustomerDNA customerId={id} />
    </AppShell>
  )
}
