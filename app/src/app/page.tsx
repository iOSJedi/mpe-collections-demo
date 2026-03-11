'use client'

import { useEffect, useCallback } from 'react'
import { DollarSign, Users, CreditCard, Building2 } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useAppDispatch, useAppSelector } from '@/store'
import { setActiveView } from '@/store/slices/navSlice'
import {
  setDashboardData,
  setDashboardLoading,
  setDashboardError,
} from '@/store/slices/dashboardSlice'
import { LoginPage } from '@/components/auth/LoginPage'
import { AppShell } from '@/components/layout/AppShell'
import { PageLoadingSpinner } from '@/components/ui/page-loading-spinner'
import { KPICard } from '@/components/dashboard/KPICard'
import { InsightCardComponent } from '@/components/dashboard/InsightCardComponent'
import { apiFetch } from '@/lib/api'
import { formatCurrency } from '@/lib/utils'

const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

function DashboardContent() {
  const dispatch = useAppDispatch()
  const { kpi, insights, loading, error, lastFetched } = useAppSelector(
    (state) => state.dashboard
  )

  const fetchData = useCallback(async () => {
    dispatch(setDashboardLoading(true))
    dispatch(setDashboardError(null))
    try {
      const [kpiRes, insightsRes] = await Promise.all([
        apiFetch('/api/kpi'),
        apiFetch('/api/insights'),
      ])

      if (!kpiRes.ok || !insightsRes.ok) {
        throw new Error('Failed to load dashboard data')
      }

      const kpiData = await kpiRes.json()
      const insightsData = await insightsRes.json()

      dispatch(setDashboardData({ kpi: kpiData, insights: insightsData.insights ?? [] }))
    } catch (err) {
      console.error('Dashboard fetch error:', err)
      dispatch(setDashboardError('Unable to load dashboard data. Please try again.'))
    } finally {
      dispatch(setDashboardLoading(false))
    }
  }, [dispatch])

  useEffect(() => {
    if (lastFetched && Date.now() - lastFetched < CACHE_TTL && kpi) return
    fetchData()
  }, [fetchData, lastFetched, kpi])

  if (loading && !kpi) {
    return (
      <div className="space-y-8">
        {/* Greeting skeleton */}
        <div>
          <div className="h-7 w-96 bg-muted animate-pulse rounded-md" />
          <div className="h-4 w-64 bg-muted animate-pulse rounded-md mt-2" />
        </div>

        {/* KPI card skeletons */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="rounded-xl border bg-white p-5 space-y-3"
            >
              <div className="flex items-center justify-between">
                <div className="h-4 w-24 bg-muted animate-pulse rounded" />
                <div className="h-8 w-8 bg-muted animate-pulse rounded-lg" />
              </div>
              <div className="h-7 w-32 bg-muted animate-pulse rounded" />
              <div className="h-3 w-20 bg-muted animate-pulse rounded" />
            </div>
          ))}
        </div>

        {/* Insight card skeletons */}
        <div className="space-y-4">
          <div>
            <div className="h-5 w-20 bg-muted animate-pulse rounded" />
            <div className="h-3 w-56 bg-muted animate-pulse rounded mt-2" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="rounded-xl border bg-white p-5 space-y-3"
              >
                <div className="flex items-center gap-2">
                  <div className="h-5 w-5 bg-muted animate-pulse rounded-full" />
                  <div className="h-4 w-40 bg-muted animate-pulse rounded" />
                </div>
                <div className="space-y-2">
                  <div className="h-3 w-full bg-muted animate-pulse rounded" />
                  <div className="h-3 w-4/5 bg-muted animate-pulse rounded" />
                </div>
                <div className="h-8 w-28 bg-muted animate-pulse rounded-md" />
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (error && !kpi) {
    return (
      <div className="flex flex-col items-center justify-center py-24 space-y-4">
        <p className="text-destructive font-medium">{error}</p>
        <button
          onClick={fetchData}
          className="text-sm text-secondary hover:text-secondary/80 underline transition-colors"
        >
          Try again
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Greeting */}
      <div>
        <h1 className="text-2xl font-bold text-primary">
          {getGreeting()} — here&apos;s what&apos;s happening across your 7 branches
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Real-time overview of sales, customers, and credit health
        </p>
      </div>

      {/* KPI Cards */}
      {kpi && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KPICard
            title="Revenue This Month"
            value={formatCurrency(kpi.revenue.this_month, true)}
            change={kpi.revenue.change_pct}
            subtitle="vs last month"
            icon={<DollarSign className="h-5 w-5" />}
          />
          <KPICard
            title="Active Customers"
            value={kpi.active_customers.total.toLocaleString()}
            subtitle={`${kpi.active_customers.retail} retail / ${kpi.active_customers.wholesale} wholesale`}
            icon={<Users className="h-5 w-5" />}
          />
          <KPICard
            title="Wholesale Credit"
            value={formatCurrency(kpi.wholesale_credit.outstanding, true)}
            subtitle={`${kpi.wholesale_credit.overdue_pct}% overdue`}
            icon={<CreditCard className="h-5 w-5" />}
          />
          <KPICard
            title="Top Branch"
            value={kpi.top_branch.branch_name ?? 'N/A'}
            subtitle={formatCurrency(kpi.top_branch.revenue, true)}
            icon={<Building2 className="h-5 w-5" />}
          />
        </div>
      )}

      {/* Insights Section */}
      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-primary">Insights</h2>
          <p className="text-muted-foreground text-sm">
            AI-generated observations and recommended actions
          </p>
        </div>

        {insights.length === 0 ? (
          <div className="rounded-xl border bg-white p-8 text-center">
            <p className="text-muted-foreground">
              No insights available yet. Run the analytics pipeline to generate insights.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {insights.map((insight) => (
              <InsightCardComponent key={insight.id} insight={insight} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default function Home() {
  const { user, loading } = useAuth()
  const dispatch = useAppDispatch()

  useEffect(() => {
    dispatch(setActiveView('dashboard'))
  }, [dispatch])

  if (loading) return <PageLoadingSpinner message="Loading dashboard..." />
  if (!user) return <LoginPage />

  return (
    <AppShell>
      <div className="p-6 max-w-7xl mx-auto">
        <DashboardContent />
      </div>
    </AppShell>
  )
}
