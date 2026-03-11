'use client'
import { useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { LoginPage } from '@/components/auth/LoginPage'
import { AppShell } from '@/components/layout/AppShell'
import { PageLoadingSpinner } from '@/components/ui/page-loading-spinner'
import { useAppDispatch } from '@/store'
import { navigate } from '@/store/slices/navSlice'
import { Worklist } from '@/components/collections/Worklist'

export default function CollectionsPage() {
  const { user, loading } = useAuth()
  const dispatch = useAppDispatch()

  useEffect(() => {
    dispatch(navigate({ space: 'collections', page: 'collections-worklist' }))
  }, [dispatch])

  if (loading) return <PageLoadingSpinner message="Loading..." />
  if (!user) return <LoginPage />

  return (
    <AppShell>
      <div className="p-6 space-y-6">
        <h1 className="text-2xl font-bold text-primary">Collections Worklist</h1>
        <Worklist />
      </div>
    </AppShell>
  )
}
