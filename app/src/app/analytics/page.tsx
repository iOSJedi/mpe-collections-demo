'use client'
import { useAuth } from '@/contexts/AuthContext'
import { LoginPage } from '@/components/auth/LoginPage'
import { AppShell } from '@/components/layout/AppShell'
import { PageLoadingSpinner } from '@/components/ui/page-loading-spinner'
import { AnalyticsPanel } from '@/components/analytics/AnalyticsPanel'
import { useAppDispatch } from '@/store'
import { setActiveView } from '@/store/slices/navSlice'
import { useEffect } from 'react'

export default function AnalyticsPage() {
  const { user, loading } = useAuth()
  const dispatch = useAppDispatch()
  useEffect(() => { dispatch(setActiveView('analytics')) }, [dispatch])

  if (loading) return <PageLoadingSpinner message="Loading analytics..." />
  if (!user) return <LoginPage />

  return <AppShell><AnalyticsPanel /></AppShell>
}
