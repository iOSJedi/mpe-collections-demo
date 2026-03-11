'use client'
import { useAuth } from '@/contexts/AuthContext'
import { LoginPage } from '@/components/auth/LoginPage'
import { AppShell } from '@/components/layout/AppShell'
import { PageLoadingSpinner } from '@/components/ui/page-loading-spinner'
import { BranchComparison } from '@/components/branches/BranchComparison'
import { useAppDispatch } from '@/store'
import { setActiveView } from '@/store/slices/navSlice'
import { useEffect } from 'react'

export default function BranchesPage() {
  const { user, loading } = useAuth()
  const dispatch = useAppDispatch()
  useEffect(() => { dispatch(setActiveView('branches')) }, [dispatch])

  if (loading) return <PageLoadingSpinner message="Loading branch data..." />
  if (!user) return <LoginPage />

  return <AppShell><BranchComparison /></AppShell>
}
