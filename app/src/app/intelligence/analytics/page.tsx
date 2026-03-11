'use client'

import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { LoginPage } from '@/components/auth/LoginPage'
import { AppShell } from '@/components/layout/AppShell'
import { PageLoadingSpinner } from '@/components/ui/page-loading-spinner'
import { useAppDispatch } from '@/store'
import { navigate } from '@/store/slices/navSlice'
import { apiFetch } from '@/lib/api'
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'

interface CashFlowPoint {
  forecast_date: string
  predicted_inflow: number
  predicted_outflow: number
  confidence_lower?: number
  confidence_upper?: number
}

interface CollectionPoint {
  month: string
  collected: number
  outstanding: number
}

interface CreditRiskPoint {
  risk_level: string
  count: number
}

const RISK_COLORS: Record<string, string> = {
  LOW: '#10b981',
  MEDIUM: '#f59e0b',
  HIGH: '#f97316',
  CRITICAL: '#ef4444',
}

function formatPHP(value: number): string {
  if (value >= 1_000_000) return `₱${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `₱${(value / 1_000).toFixed(0)}K`
  return `₱${value.toFixed(0)}`
}

function SectionCard({ title, subtitle, children }: {
  title: string
  subtitle?: string
  children: React.ReactNode
}) {
  return (
    <div className="rounded-xl border bg-white p-6">
      <div className="mb-4">
        <h2 className="text-base font-semibold text-primary">{title}</h2>
        {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
      </div>
      {children}
    </div>
  )
}

function EmptyChart({ message }: { message: string }) {
  return (
    <div className="h-64 flex items-center justify-center">
      <p className="text-muted-foreground text-sm">{message}</p>
    </div>
  )
}

function AnalyticsContent() {
  const [cashFlow, setCashFlow] = useState<CashFlowPoint[]>([])
  const [collections, setCollections] = useState<CollectionPoint[]>([])
  const [creditRisk, setCreditRisk] = useState<CreditRiskPoint[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [cashFlowRes, collectionsRes, creditRiskRes] = await Promise.all([
        apiFetch('/api/intelligence/cash-flow'),
        apiFetch('/api/intelligence/collections-trend'),
        apiFetch('/api/intelligence/credit-risk-distribution'),
      ])

      if (cashFlowRes.ok) {
        const data = await cashFlowRes.json()
        setCashFlow(data.forecasts ?? [])
      }

      if (collectionsRes.ok) {
        const data = await collectionsRes.json()
        setCollections(data.trend ?? [])
      }

      if (creditRiskRes.ok) {
        const data = await creditRiskRes.json()
        setCreditRisk(data.distribution ?? [])
      }
    } catch (err) {
      console.error('Analytics fetch error:', err)
      setError('Unable to load analytics data. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-xl border bg-white p-6 h-80" />
        ))}
      </div>
    )
  }

  if (error) {
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
    <div className="space-y-6">
      {/* Cash Flow Forecast */}
      <SectionCard
        title="Cash Flow Forecast"
        subtitle="Predicted inflow vs outflow over the forecast period (PHP)"
      >
        {cashFlow.length < 2 ? (
          <EmptyChart message="No cash flow forecast data available. Run the ML pipeline to generate forecasts." />
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={cashFlow} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis
                dataKey="forecast_date"
                tick={{ fontSize: 11 }}
                tickFormatter={(v) => {
                  const d = new Date(v)
                  return `${d.toLocaleString('default', { month: 'short' })} ${d.getDate()}`
                }}
              />
              <YAxis
                tick={{ fontSize: 11 }}
                tickFormatter={formatPHP}
                width={70}
              />
              <Tooltip
                formatter={(value: number | undefined) => formatPHP(value ?? 0)}
                labelFormatter={(label) => `Date: ${label}`}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="predicted_inflow"
                name="Predicted Inflow"
                stroke="#10b981"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
              <Line
                type="monotone"
                dataKey="predicted_outflow"
                name="Predicted Outflow"
                stroke="#ef4444"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </SectionCard>

      {/* Collection Rate Trend */}
      <SectionCard
        title="Collection Rate Trend"
        subtitle="Monthly collections vs outstanding balance (PHP)"
      >
        {collections.length === 0 ? (
          <EmptyChart message="No collection trend data available." />
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={collections} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={formatPHP} width={70} />
              <Tooltip formatter={(value: number | undefined) => formatPHP(value ?? 0)} />
              <Legend />
              <Bar dataKey="collected" name="Collected" fill="#3b82f6" radius={[3, 3, 0, 0]} />
              <Bar dataKey="outstanding" name="Outstanding" fill="#f59e0b" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </SectionCard>

      {/* Credit Risk Distribution */}
      <SectionCard
        title="Credit Risk Distribution"
        subtitle="Number of customers by credit risk level"
      >
        {creditRisk.length === 0 ? (
          <EmptyChart message="No credit risk data available." />
        ) : (
          <div className="flex flex-col lg:flex-row items-center gap-8">
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={creditRisk}
                  dataKey="count"
                  nameKey="risk_level"
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  innerRadius={55}
                  paddingAngle={3}
                  label={({ name, percent }: { name?: string; percent?: number }) =>
                    `${name ?? ''} ${((percent ?? 0) * 100).toFixed(0)}%`
                  }
                  labelLine={false}
                >
                  {creditRisk.map((entry) => (
                    <Cell
                      key={entry.risk_level}
                      fill={RISK_COLORS[entry.risk_level] ?? '#8b5cf6'}
                    />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number | undefined) => `${value ?? 0} customers`} />
              </PieChart>
            </ResponsiveContainer>

            {/* Legend */}
            <div className="flex flex-col gap-3 shrink-0">
              {creditRisk.map((entry) => (
                <div key={entry.risk_level} className="flex items-center gap-2 text-sm">
                  <span
                    className="inline-block h-3 w-3 rounded-sm shrink-0"
                    style={{ backgroundColor: RISK_COLORS[entry.risk_level] ?? '#8b5cf6' }}
                  />
                  <span className="text-muted-foreground w-20">{entry.risk_level}</span>
                  <span className="font-medium text-foreground">{entry.count} customers</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </SectionCard>
    </div>
  )
}

export default function AnalyticsPage() {
  const { user, loading } = useAuth()
  const dispatch = useAppDispatch()

  useEffect(() => {
    dispatch(navigate({ space: 'intelligence', page: 'analytics' }))
  }, [dispatch])

  if (loading) return <PageLoadingSpinner message="Loading analytics..." />
  if (!user) return <LoginPage />

  return (
    <AppShell>
      <div className="p-6 max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-primary">Analytics</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Cash flow forecasts, collection trends, and credit risk distribution
          </p>
        </div>
        <AnalyticsContent />
      </div>
    </AppShell>
  )
}
