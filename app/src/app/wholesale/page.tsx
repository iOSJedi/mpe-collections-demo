'use client'
import { useAuth } from '@/contexts/AuthContext'
import { LoginPage } from '@/components/auth/LoginPage'
import { AppShell } from '@/components/layout/AppShell'
import { PageLoadingSpinner } from '@/components/ui/page-loading-spinner'
import { WholesaleMonitor } from '@/components/wholesale/WholesaleMonitor'
import { useAppDispatch } from '@/store'
import { setActiveView } from '@/store/slices/navSlice'
import { useEffect } from 'react'

export default function WholesalePage() {
  const { user, loading } = useAuth()
  const dispatch = useAppDispatch()
  useEffect(() => { dispatch(setActiveView('wholesale')) }, [dispatch])

  if (loading) return <PageLoadingSpinner message="Loading wholesale data..." />
  if (!user) return <LoginPage />

  return <AppShell><WholesaleMonitor /></AppShell>
}
