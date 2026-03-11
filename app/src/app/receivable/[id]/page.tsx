'use client'
import { useEffect } from 'react'
import { useParams } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { LoginPage } from '@/components/auth/LoginPage'
import { AppShell } from '@/components/layout/AppShell'
import { PageLoadingSpinner } from '@/components/ui/page-loading-spinner'
import { useAppDispatch } from '@/store'
import { navigate } from '@/store/slices/navSlice'
import { CustomerDetail } from '@/components/receivable/CustomerDetail'

export default function CustomerDetailPage() {
  const { user, loading } = useAuth()
  const dispatch = useAppDispatch()
  const params = useParams()
  const customerId = Number(params.id)

  useEffect(() => {
    dispatch(navigate({ space: 'receivable', page: 'customer-accounts' }))
  }, [dispatch])

  if (loading) return <PageLoadingSpinner message="Loading..." />
  if (!user) return <LoginPage />

  return (
    <AppShell>
      <CustomerDetail customerId={customerId} />
    </AppShell>
  )
}
