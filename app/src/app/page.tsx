'use client'

import { useEffect, useRef, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useAppDispatch, useAppSelector } from '@/store'
import { navigate } from '@/store/slices/navSlice'
import { fetchKPIs, fetchInsights } from '@/store/slices/dashboardSlice'
import { LoginPage } from '@/components/auth/LoginPage'
import { AppShell } from '@/components/layout/AppShell'
import { PageLoadingSpinner } from '@/components/ui/page-loading-spinner'
import { InsightCardComponent } from '@/components/dashboard/InsightCardComponent'
import { OverviewKPIsComponent } from '@/components/dashboard/OverviewKPIs'
import { AgingChart } from '@/components/dashboard/AgingChart'
import type { AgingBucket } from '@/components/dashboard/AgingChart'
import { apiFetch } from '@/lib/api'
import { formatCurrency } from '@/lib/utils'
import { AlertCircle, RefreshCw, Package, Users, ShieldAlert } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

function DashboardContent() {
  const dispatch = useAppDispatch()
  const { kpis, insights, loading, error } = useAppSelector((state) => state.dashboard)
  const [agingData, setAgingData] = useState<AgingBucket[]>([])
  const [agingLoading, setAgingLoading] = useState(false)
  const fetchedRef = useRef(false)

  useEffect(() => {
    if (fetchedRef.current) return
    fetchedRef.current = true

    dispatch(fetchKPIs())
    dispatch(fetchInsights())

    setAgingLoading(true)
    apiFetch('/api/kpi/aging')
      .then((res) => (res.ok ? res.json() : []))
      .then((data: AgingBucket[]) => setAgingData(data))
      .catch(() => setAgingData([]))
      .finally(() => setAgingLoading(false))
  }, [dispatch])

  if (loading && !kpis) {
    return (
      <div className="space-y-8">
        {/* Header skeleton */}
        <div className="space-y-2">
          <div className="h-7 w-72 bg-muted animate-pulse rounded-md" />
          <div className="h-4 w-48 bg-muted animate-pulse rounded-md" />
        </div>

        {/* KPI card skeletons */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-xl border bg-white p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="h-4 w-24 bg-muted animate-pulse rounded" />
                <div className="h-8 w-8 bg-muted animate-pulse rounded-lg" />
              </div>
              <div className="h-7 w-32 bg-muted animate-pulse rounded" />
              <div className="h-3 w-20 bg-muted animate-pulse rounded" />
            </div>
          ))}
        </div>

        {/* Chart + stats skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 rounded-xl border bg-white p-5 h-64 animate-pulse bg-muted" />
          <div className="rounded-xl border bg-white p-5 space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-14 bg-muted animate-pulse rounded-lg" />
            ))}
          </div>
        </div>

        {/* Insight skeletons */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-xl border bg-white p-5 space-y-3">
              <div className="h-4 w-40 bg-muted animate-pulse rounded" />
              <div className="h-3 w-full bg-muted animate-pulse rounded" />
              <div className="h-3 w-4/5 bg-muted animate-pulse rounded" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (error && !kpis) {
    return (
      <div className="flex flex-col items-center justify-center py-24 space-y-4">
        <AlertCircle className="h-8 w-8 text-destructive" />
        <p className="text-destructive font-medium">{error}</p>
        <button
          onClick={() => {
            fetchedRef.current = false
            dispatch(fetchKPIs())
            dispatch(fetchInsights())
          }}
          className="inline-flex items-center gap-2 text-sm text-secondary hover:text-secondary/80 underline transition-colors"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Try again
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Page title */}
      <div>
        <h1 className="text-2xl font-bold text-primary">Collections Overview</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Real-time AR/AP health across all properties
        </p>
      </div>

      {/* KPI tiles */}
      {kpis && <OverviewKPIsComponent kpis={kpis} />}

      {/* Aging chart + Quick stats */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Aging chart (2/3) */}
        <div className="lg:col-span-2">
          {agingLoading ? (
            <div className="rounded-xl border bg-white h-[316px] animate-pulse bg-muted" />
          ) : (
            <AgingChart data={agingData} />
          )}
        </div>

        {/* Quick stats (1/3) */}
        <Card className="bg-white shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold text-primary">Quick Stats</CardTitle>
            <p className="text-xs text-muted-foreground">Portfolio snapshot</p>
          </CardHeader>
          <CardContent className="space-y-3">
            {kpis && (
              <>
                <div className="flex items-center gap-3 rounded-lg bg-muted/40 p-3">
                  <Users className="h-5 w-5 text-secondary shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">Total Customers</p>
                    <p className="text-lg font-bold text-primary">
                      {kpis.total_customers.toLocaleString()}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 rounded-lg bg-amber-50 p-3">
                  <AlertCircle className="h-5 w-5 text-amber-500 shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">Overdue Customers</p>
                    <p className="text-lg font-bold text-primary">
                      {kpis.overdue_customers.toLocaleString()}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 rounded-lg bg-red-50 p-3">
                  <ShieldAlert className="h-5 w-5 text-destructive shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">Blocked AP Invoices</p>
                    <p className="text-lg font-bold text-primary">
                      {kpis.blocked_invoices.toLocaleString()}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 rounded-lg bg-muted/40 p-3">
                  <Package className="h-5 w-5 text-secondary shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">Total Payables</p>
                    <p className="text-lg font-bold text-primary">
                      {formatCurrency(kpis.total_payables, true)}
                    </p>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Insight cards */}
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
    dispatch(navigate({ space: 'overview', page: 'overview' }))
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
