'use client'
import { use, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { LoginPage } from '@/components/auth/LoginPage'
import { AppShell } from '@/components/layout/AppShell'
import { PageLoadingSpinner } from '@/components/ui/page-loading-spinner'
import { useAppDispatch } from '@/store'
import { navigate } from '@/store/slices/navSlice'
import { SupplierDetail } from '@/components/payable/SupplierDetail'

interface Props {
  params: Promise<{ id: string }>
}

export default function SupplierDetailPage({ params }: Props) {
  const { user, loading } = useAuth()
  const dispatch = useAppDispatch()
  const { id } = use(params)
  const supplierId = parseInt(id, 10)

  useEffect(() => {
    dispatch(navigate({ space: 'payable', page: 'supplier-accounts' }))
  }, [dispatch])

  if (loading) return <PageLoadingSpinner message="Loading..." />
  if (!user) return <LoginPage />

  return (
    <AppShell>
      <div className="p-6 space-y-6">
        <SupplierDetail supplierId={supplierId} />
      </div>
    </AppShell>
  )
}
