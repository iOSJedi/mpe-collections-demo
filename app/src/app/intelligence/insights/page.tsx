'use client'

import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { LoginPage } from '@/components/auth/LoginPage'
import { AppShell } from '@/components/layout/AppShell'
import { PageLoadingSpinner } from '@/components/ui/page-loading-spinner'
import { useAppDispatch } from '@/store'
import { navigate } from '@/store/slices/navSlice'
import { InsightCardComponent } from '@/components/dashboard/InsightCardComponent'
import { apiFetch } from '@/lib/api'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { InsightCard } from '@/types'

interface DelinquencyRow {
  customer_id: number
  name: string
  property_name: string | null
  risk_score: number
  risk_level: string
  top_risk_factor: string | null
  days_overdue_avg: number | null
  missed_payments: number | null
}

interface SegmentCount {
  segment_name: string
  count: number
}

const riskLevelConfig: Record<string, { label: string; className: string }> = {
  LOW: { label: 'Low', className: 'bg-success/15 text-success border-success/30' },
  MEDIUM: { label: 'Medium', className: 'bg-warning/15 text-warning border-warning/30' },
  HIGH: { label: 'High', className: 'bg-orange-500/15 text-orange-600 border-orange-500/30' },
  CRITICAL: { label: 'Critical', className: 'bg-destructive/15 text-destructive border-destructive/30' },
}

function RiskBadge({ level }: { level: string }) {
  const config = riskLevelConfig[level] ?? { label: level, className: 'bg-muted text-muted-foreground' }
  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border',
        config.className
      )}
    >
      {config.label}
    </span>
  )
}

function SegmentBar({ name, count, max }: { name: string; count: number; max: number }) {
  const pct = max > 0 ? Math.round((count / max) * 100) : 0
  return (
    <div className="flex items-center gap-3">
      <div className="w-40 shrink-0 text-sm text-muted-foreground truncate" title={name}>
        {name}
      </div>
      <div className="flex-1 bg-muted rounded-full h-2.5 overflow-hidden">
        <div
          className="bg-secondary h-full rounded-full transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="w-8 text-right text-sm font-medium text-foreground">{count}</div>
    </div>
  )
}

function InsightsContent() {
  const [insights, setInsights] = useState<InsightCard[]>([])
  const [delinquency, setDelinquency] = useState<DelinquencyRow[]>([])
  const [segments, setSegments] = useState<SegmentCount[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pipelineRunning, setPipelineRunning] = useState(false)
  const [pipelineResult, setPipelineResult] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [insightsRes, delinquencyRes, segmentsRes] = await Promise.all([
        apiFetch('/api/insights'),
        apiFetch('/api/intelligence/delinquency'),
        apiFetch('/api/intelligence/segments'),
      ])

      if (insightsRes.ok) {
        const data = await insightsRes.json()
        setInsights(data.insights ?? [])
      }

      if (delinquencyRes.ok) {
        const data = await delinquencyRes.json()
        setDelinquency(data.rows ?? [])
      }

      if (segmentsRes.ok) {
        const data = await segmentsRes.json()
        setSegments(data.segments ?? [])
      }
    } catch (err) {
      console.error('Insights fetch error:', err)
      setError('Unable to load insights data. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [])

  const runPipeline = useCallback(async () => {
    setPipelineRunning(true)
    setPipelineResult(null)
    try {
      const res = await apiFetch('/api/ml/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tasks: [
            'payment_patterns',
            'payer_segmentation',
            'delinquency_scoring',
            'credit_risk',
            'cash_flow_forecast',
          ],
        }),
      })
      if (!res.ok) throw new Error('Pipeline request failed')
      const data = await res.json()
      const completed = data.body?.tasks_completed ?? data.tasks_completed ?? []
      setPipelineResult(`Completed ${completed.length} tasks`)
      // Also refresh insights
      await apiFetch('/api/cron/refresh-insights', { method: 'POST' })
      // Re-fetch display data
      await fetchData()
    } catch (err) {
      console.error('Pipeline error:', err)
      setPipelineResult('Pipeline failed — check console for details')
    } finally {
      setPipelineRunning(false)
    }
  }, [fetchData])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const maxSegmentCount = Math.max(...segments.map((s) => s.count), 1)

  if (loading) {
    return (
      <div className="space-y-8 animate-pulse">
        <div className="h-6 w-48 bg-muted rounded" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-xl border bg-white p-5 h-28" />
          ))}
        </div>
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

  const isEmpty = insights.length === 0 && delinquency.length === 0 && segments.length === 0

  return (
    <div className="space-y-10">
      {/* Pipeline controls */}
      <div className="flex items-center gap-4 flex-wrap">
        <button
          onClick={runPipeline}
          disabled={pipelineRunning}
          className={cn(
            'inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors',
            pipelineRunning
              ? 'bg-muted text-muted-foreground cursor-not-allowed'
              : 'bg-secondary text-secondary-foreground hover:bg-secondary/90 shadow-sm'
          )}
        >
          {pipelineRunning ? (
            <>
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Running Pipeline…
            </>
          ) : (
            <>
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
              Run Analysis Pipeline
            </>
          )}
        </button>
        {pipelineResult && (
          <span className="text-sm text-muted-foreground">{pipelineResult}</span>
        )}
        {isEmpty && !pipelineRunning && (
          <span className="text-sm text-muted-foreground">
            No analysis data found. Click &quot;Run Analysis Pipeline&quot; to generate scores, segments, and forecasts.
          </span>
        )}
      </div>

      {/* AI Insight Cards */}
      <section>
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-primary">AI Insight Cards</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Automatically generated observations and recommended actions
          </p>
        </div>
        {insights.length === 0 ? (
          <div className="rounded-xl border bg-white p-8 text-center">
            <p className="text-muted-foreground text-sm">
              No active insight cards. Run the ML pipeline to generate new insights.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {insights.map((insight) => (
              <InsightCardComponent key={insight.id} insight={insight} />
            ))}
          </div>
        )}
      </section>

      {/* Delinquency Risk Table */}
      <section>
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-primary">Delinquency Risk</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Customers ranked by delinquency risk score
          </p>
        </div>
        <div className="rounded-xl border bg-white overflow-hidden">
          {delinquency.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-muted-foreground text-sm">No delinquency data available.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40">
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Customer</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Property</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Risk Level</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground">Score</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground">Avg Days Overdue</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground">Missed</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Top Risk Factor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {delinquency.map((row) => (
                    <tr key={row.customer_id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3 font-medium text-foreground">{row.name}</td>
                      <td className="px-4 py-3 text-muted-foreground">{row.property_name ?? '—'}</td>
                      <td className="px-4 py-3">
                        <RiskBadge level={row.risk_level} />
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {(Number(row.risk_score) * 100).toFixed(0)}%
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                        {row.days_overdue_avg != null ? `${Number(row.days_overdue_avg).toFixed(0)}d` : '—'}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                        {row.missed_payments ?? 0}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground max-w-xs truncate">
                        {row.top_risk_factor ?? '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {/* Segment Distribution */}
      <section>
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-primary">Payer Segment Distribution</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Breakdown of customers by payment behaviour segment
          </p>
        </div>
        <div className="rounded-xl border bg-white p-6">
          {segments.length === 0 ? (
            <p className="text-muted-foreground text-sm text-center">No segment data available.</p>
          ) : (
            <div className="space-y-4">
              {segments.map((seg) => (
                <SegmentBar
                  key={seg.segment_name}
                  name={seg.segment_name}
                  count={seg.count}
                  max={maxSegmentCount}
                />
              ))}
              <p className="text-xs text-muted-foreground pt-2">
                Total: {segments.reduce((sum, s) => sum + s.count, 0)} customers
              </p>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}

export default function InsightsPage() {
  const { user, loading } = useAuth()
  const dispatch = useAppDispatch()

  useEffect(() => {
    dispatch(navigate({ space: 'intelligence', page: 'insights-scoring' }))
  }, [dispatch])

  if (loading) return <PageLoadingSpinner message="Loading insights..." />
  if (!user) return <LoginPage />

  return (
    <AppShell>
      <div className="p-6 max-w-7xl mx-auto">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-primary">Insights & Scoring</h1>
            <p className="text-muted-foreground text-sm mt-1">
              ML-generated risk scores, payer segments, and AI insight cards
            </p>
          </div>
        </div>
        <InsightsContent />
      </div>
    </AppShell>
  )
}
