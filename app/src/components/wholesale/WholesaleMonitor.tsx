'use client'

import { useEffect, useCallback, useState } from 'react'
import Link from 'next/link'
import {
  ArrowUpRight,
  ArrowDownRight,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  ShieldCheck,
} from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { useAppDispatch, useAppSelector } from '@/store'
import {
  setBuyers,
  setWholesaleLoading,
  setWholesaleFilters,
} from '@/store/slices/wholesaleSlice'
import { apiFetch } from '@/lib/api'
import { formatCurrency } from '@/lib/utils'
import type { WholesaleBuyer } from '@/types'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const BRANCHES = [
  'all',
  'SM City Batangas',
  'SM City Lipa',
  'Robinsons Place Lipa',
  'Bay City Mall Balayan',
  'ICM Calapan',
  'Batangas Town Center',
  'Lipa De La Salle Area',
]

const RISK_LEVELS = ['all', 'low', 'medium', 'high', 'critical'] as const
const SORT_OPTIONS = [
  { value: 'risk_score', label: 'Risk Score' },
  { value: 'total_spend', label: 'Total Spend' },
  { value: 'avg_days_overdue', label: 'Days Overdue' },
  { value: 'last_order_date', label: 'Last Order' },
]

function getRiskColor(level: string): string {
  switch (level.toLowerCase()) {
    case 'critical':
      return 'bg-red-500'
    case 'high':
      return 'bg-red-400'
    case 'medium':
      return 'bg-yellow-500'
    case 'low':
      return 'bg-green-500'
    default:
      return 'bg-gray-400'
  }
}

function getRiskBadgeVariant(level: string): 'destructive' | 'warning' | 'success' | 'secondary' {
  switch (level.toLowerCase()) {
    case 'critical':
    case 'high':
      return 'destructive'
    case 'medium':
      return 'warning'
    case 'low':
      return 'success'
    default:
      return 'secondary'
  }
}

function getCreditUtilColor(util: number): string {
  if (util > 0.8) return 'bg-red-500'
  if (util > 0.5) return 'bg-yellow-500'
  return 'bg-green-500'
}

function getCreditUtilTrackColor(util: number): string {
  if (util > 0.8) return 'bg-red-100'
  if (util > 0.5) return 'bg-yellow-100'
  return 'bg-green-100'
}

function TrendArrow({ value, label }: { value: number; label: string }) {
  if (value > 0) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-green-600">
        <ArrowUpRight className="h-3.5 w-3.5" />
        {label}
      </span>
    )
  }
  if (value < 0) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-red-600">
        <ArrowDownRight className="h-3.5 w-3.5" />
        {label}
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs text-gray-500">
      <ArrowRight className="h-3.5 w-3.5" />
      {label}
    </span>
  )
}

function PaymentTrendLabel({ trend }: { trend: string }) {
  const lower = trend.toLowerCase()
  if (lower === 'improving') {
    return (
      <span className="text-xs font-medium text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
        Improving
      </span>
    )
  }
  if (lower === 'deteriorating') {
    return (
      <span className="text-xs font-medium text-red-600 bg-red-50 px-2 py-0.5 rounded-full">
        Deteriorating
      </span>
    )
  }
  return (
    <span className="text-xs font-medium text-gray-600 bg-gray-100 px-2 py-0.5 rounded-full">
      Stable
    </span>
  )
}

function BuyerCard({ buyer }: { buyer: WholesaleBuyer }) {
  const [expanded, setExpanded] = useState(false)

  const creditUtil = buyer.credit_limit > 0
    ? buyer.outstanding_balance / buyer.credit_limit
    : 0

  const riskScoreDisplay = Math.round(buyer.risk_score * 100)

  const last6Months = buyer.monthly_totals.slice(-6)

  return (
    <Card className="bg-white shadow-sm hover:shadow-md transition-shadow">
      <CardContent className="p-5">
        {/* Top row: name + health indicator */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold text-sm truncate">
                {buyer.business_name}
              </h3>
              <Badge variant={getRiskBadgeVariant(buyer.risk_level)} className="text-[10px]">
                {buyer.risk_level.toUpperCase()}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {buyer.first_name} {buyer.last_name}
            </p>
            <p className="text-[11px] text-muted-foreground">
              {buyer.branch_name}
            </p>
          </div>
          <div className="flex-shrink-0 flex items-center gap-2">
            <div
              className={`h-5 w-5 rounded-full ${getRiskColor(buyer.risk_level)} shadow-sm`}
              title={`Risk: ${buyer.risk_level}`}
            />
          </div>
        </div>

        {/* Metrics grid */}
        <div className="mt-4 grid grid-cols-2 gap-3">
          {/* Risk Score */}
          <div>
            <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide">
              Risk Score
            </p>
            <p className="text-lg font-bold text-primary">{riskScoreDisplay}</p>
          </div>

          {/* Avg Days Overdue */}
          <div>
            <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide">
              Avg Days Overdue
            </p>
            <p className={`text-lg font-bold ${buyer.avg_days_overdue > 30 ? 'text-red-600' : buyer.avg_days_overdue > 15 ? 'text-yellow-600' : 'text-primary'}`}>
              {buyer.avg_days_overdue}
            </p>
          </div>
        </div>

        {/* Credit Utilization */}
        <div className="mt-3">
          <div className="flex items-center justify-between mb-1">
            <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide">
              Credit Utilization
            </p>
            <p className="text-xs font-medium">
              {formatCurrency(buyer.outstanding_balance, true)} / {formatCurrency(buyer.credit_limit, true)}
            </p>
          </div>
          <div className={`h-2 rounded-full ${getCreditUtilTrackColor(creditUtil)}`}>
            <div
              className={`h-2 rounded-full ${getCreditUtilColor(creditUtil)} transition-all`}
              style={{ width: `${Math.min(creditUtil * 100, 100)}%` }}
            />
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5 text-right">
            {(creditUtil * 100).toFixed(0)}%
          </p>
        </div>

        {/* Trends */}
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <TrendArrow value={buyer.order_frequency_trend} label="Orders" />
          <TrendArrow value={buyer.basket_size_trend} label="Basket" />
          <PaymentTrendLabel trend={buyer.payment_trend} />
        </div>

        {/* Last order + actions */}
        <div className="mt-3 flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            Last order:{' '}
            {buyer.last_order_date
              ? new Date(buyer.last_order_date).toLocaleDateString('en-PH', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })
              : 'N/A'}
          </p>
          <Link href={`/customers/${buyer.customer_id}`}>
            <Button variant="ghost" size="sm" className="text-xs h-7">
              View Profile
            </Button>
          </Link>
        </div>

        {/* Expandable section */}
        <div className="mt-2 border-t pt-2">
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors w-full"
          >
            {expanded ? (
              <ChevronUp className="h-3.5 w-3.5" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" />
            )}
            {expanded ? 'Hide details' : 'Show monthly revenue & risk factor'}
          </button>

          {expanded && (
            <div className="mt-3 space-y-3">
              {/* Monthly totals chart */}
              {last6Months.length > 0 && (
                <div>
                  <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide mb-2">
                    Monthly Revenue (Last 6 Months)
                  </p>
                  <div className="h-32">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={last6Months}>
                        <XAxis
                          dataKey="month"
                          tick={{ fontSize: 10 }}
                          tickFormatter={(val: string) => {
                            const d = new Date(val + '-01')
                            return d.toLocaleDateString('en-PH', { month: 'short' })
                          }}
                        />
                        <YAxis
                          tick={{ fontSize: 10 }}
                          tickFormatter={(val: number) =>
                            val >= 1000 ? `${(val / 1000).toFixed(0)}K` : String(val)
                          }
                          width={40}
                        />
                        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                        <Tooltip
                          formatter={(value: any) => [formatCurrency(Number(value)), 'Revenue']}
                          labelFormatter={(label: any) => {
                            const d = new Date(String(label) + '-01')
                            return d.toLocaleDateString('en-PH', {
                              month: 'long',
                              year: 'numeric',
                            })
                          }}
                        />
                        <Bar
                          dataKey="total"
                          fill="hsl(var(--chart-1))"
                          radius={[3, 3, 0, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* Top Risk Factor */}
              {buyer.top_risk_factor && (
                <div className="flex items-start gap-2 p-2 rounded-md bg-red-50 border border-red-100">
                  <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-[11px] text-red-700 font-medium uppercase tracking-wide">
                      Top Risk Factor
                    </p>
                    <p className="text-xs text-red-800 mt-0.5">
                      {buyer.top_risk_factor}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

export function WholesaleMonitor() {
  const dispatch = useAppDispatch()
  const { buyers, loading, filters, lastFetched } = useAppSelector((state) => state.wholesale)

  const fetchBuyers = useCallback(
    async (currentFilters: typeof filters) => {
      dispatch(setWholesaleLoading(true))
      try {
        const params = new URLSearchParams()
        if (currentFilters.branch !== 'all') params.set('branch', currentFilters.branch)
        if (currentFilters.riskLevel !== 'all') params.set('riskLevel', currentFilters.riskLevel)
        if (currentFilters.sortBy) params.set('sortBy', currentFilters.sortBy)

        const res = await apiFetch(`/api/wholesale?${params.toString()}`)
        if (!res.ok) throw new Error('Failed to fetch wholesale buyers')
        const data = await res.json()
        dispatch(setBuyers(data.buyers))
      } catch (err) {
        console.error('Error fetching wholesale buyers:', err)
      } finally {
        dispatch(setWholesaleLoading(false))
      }
    },
    [dispatch]
  )

  // Fetch on mount (skip if cached)
  useEffect(() => {
    if (lastFetched && Date.now() - lastFetched < CACHE_TTL && buyers.length > 0) return
    fetchBuyers(filters)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleFilterChange = useCallback(
    (newFilters: Partial<typeof filters>) => {
      dispatch(setWholesaleFilters(newFilters))
      const merged = { ...filters, ...newFilters }
      fetchBuyers(merged)
    },
    [dispatch, filters, fetchBuyers]
  )

  // Summary counts
  const criticalCount = buyers.filter(
    (b) => b.risk_level.toLowerCase() === 'critical' || b.risk_level.toLowerCase() === 'high'
  ).length

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-primary">Wholesale Buyer Health</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Monitor credit risk and order trends across wholesale accounts
        </p>
      </div>

      {/* Summary badges */}
      {!loading && buyers.length > 0 && (
        <div className="flex items-center gap-3 flex-wrap">
          <div className="inline-flex items-center gap-1.5 text-sm">
            <ShieldCheck className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">{buyers.length} accounts</span>
          </div>
          {criticalCount > 0 && (
            <div className="inline-flex items-center gap-1.5 text-sm text-red-600">
              <AlertTriangle className="h-4 w-4" />
              <span className="font-medium">{criticalCount} high/critical risk</span>
            </div>
          )}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Select
          value={filters.branch}
          onValueChange={(val) => handleFilterChange({ branch: val })}
        >
          <SelectTrigger className="w-[220px]">
            <SelectValue placeholder="Branch" />
          </SelectTrigger>
          <SelectContent>
            {BRANCHES.map((b) => (
              <SelectItem key={b} value={b}>
                {b === 'all' ? 'All Branches' : b}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.riskLevel}
          onValueChange={(val) => handleFilterChange({ riskLevel: val })}
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Risk Level" />
          </SelectTrigger>
          <SelectContent>
            {RISK_LEVELS.map((r) => (
              <SelectItem key={r} value={r}>
                {r === 'all' ? 'All Risk Levels' : r.charAt(0).toUpperCase() + r.slice(1)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.sortBy}
          onValueChange={(val) => handleFilterChange({ sortBy: val })}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Sort By" />
          </SelectTrigger>
          <SelectContent>
            {SORT_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Content */}
      {loading && buyers.length === 0 ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-xl border bg-white p-5 space-y-4">
                <div className="flex items-start justify-between">
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center gap-2">
                      <div className="h-4 w-36 bg-muted animate-pulse rounded" />
                      <div className="h-5 w-16 bg-muted animate-pulse rounded-full" />
                    </div>
                    <div className="h-3 w-28 bg-muted animate-pulse rounded" />
                    <div className="h-3 w-24 bg-muted animate-pulse rounded" />
                  </div>
                  <div className="h-5 w-5 bg-muted animate-pulse rounded-full" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <div className="h-3 w-16 bg-muted animate-pulse rounded" />
                    <div className="h-6 w-12 bg-muted animate-pulse rounded" />
                  </div>
                  <div className="space-y-1">
                    <div className="h-3 w-20 bg-muted animate-pulse rounded" />
                    <div className="h-6 w-10 bg-muted animate-pulse rounded" />
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="h-3 w-24 bg-muted animate-pulse rounded" />
                  <div className="h-2 w-full bg-muted animate-pulse rounded-full" />
                </div>
              </div>
            ))}
          </div>
          <p className="text-center text-sm text-muted-foreground animate-pulse">
            Loading wholesale data...
          </p>
        </div>
      ) : buyers.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No wholesale buyers match your current filters.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {buyers.map((buyer) => (
            <BuyerCard key={buyer.customer_id} buyer={buyer} />
          ))}
        </div>
      )}
    </div>
  )
}
