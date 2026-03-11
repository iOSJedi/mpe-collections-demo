'use client'

import { useEffect, useCallback } from 'react'
import { Info } from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
  CartesianGrid,
} from 'recharts'
import { useAppDispatch, useAppSelector } from '@/store'
import { setBranches, setBranchLoading } from '@/store/slices/branchSlice'
import { apiFetch } from '@/lib/api'
import { formatCurrency } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'

const CHART_COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
  'hsl(216, 47%, 35%)',
  'hsl(189, 53%, 50%)',
]

function shortenBranchName(name: string): string {
  return name
    .replace('SM City ', 'SM ')
    .replace('Robinsons Place ', 'Rob. ')
    .replace('Bay City Mall ', 'BCM ')
    .replace('ICM ', 'ICM ')
    .replace('Batangas Town Center', 'BTC')
    .replace('Lipa De La Salle Area', 'DLSA Lipa')
}

const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

export function BranchComparison() {
  const dispatch = useAppDispatch()
  const { branches, loading, lastFetched } = useAppSelector((state) => state.branch)

  const fetchBranches = useCallback(async () => {
    dispatch(setBranchLoading(true))
    try {
      const res = await apiFetch('/api/branches')
      if (!res.ok) throw new Error('Failed to fetch branches')
      const data = await res.json()
      dispatch(setBranches(data.branches))
    } catch (err) {
      console.error('Error fetching branches:', err)
    } finally {
      dispatch(setBranchLoading(false))
    }
  }, [dispatch])

  useEffect(() => {
    if (lastFetched && Date.now() - lastFetched < CACHE_TTL && branches.length > 0) return
    fetchBranches()
  }, [fetchBranches])

  // Prepare chart data
  const revenueData = branches.map((b) => ({
    name: shortenBranchName(b.branch_name),
    revenue: b.revenue_this_month,
    fullName: b.branch_name,
  }))

  const splitData = branches.map((b) => ({
    name: shortenBranchName(b.branch_name),
    retail: b.retail_revenue,
    wholesale: b.wholesale_revenue,
    fullName: b.branch_name,
  }))

  const basketData = branches.map((b) => ({
    name: shortenBranchName(b.branch_name),
    avg_basket: b.avg_basket_size,
    fullName: b.branch_name,
  }))

  // Collect all unique categories across branches for the table
  const allCategories = new Map<string, Map<string, number>>()
  branches.forEach((b) => {
    b.top_categories.forEach((cat) => {
      if (!allCategories.has(cat.category)) {
        allCategories.set(cat.category, new Map())
      }
      allCategories.get(cat.category)!.set(b.branch_name, cat.total)
    })
  })

  // Sort categories by total revenue across all branches, pick top 5
  const sortedCategories = Array.from(allCategories.entries())
    .map(([category, branchMap]) => ({
      category,
      totalRevenue: Array.from(branchMap.values()).reduce((sum, v) => sum + v, 0),
      branchMap,
    }))
    .sort((a, b) => b.totalRevenue - a.totalRevenue)
    .slice(0, 5)

  if (loading && branches.length === 0) {
    return (
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-primary">Branch Performance</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Compare metrics across all 7 branches
          </p>
        </div>

        {/* Revenue chart skeleton */}
        <div className="rounded-xl border bg-white p-5 space-y-4">
          <div className="h-5 w-48 bg-muted animate-pulse rounded" />
          <div className="h-3 w-64 bg-muted animate-pulse rounded" />
          <div className="h-80 bg-muted/40 animate-pulse rounded-lg flex items-end justify-around px-6 pb-4 gap-3">
            {[65, 82, 45, 90, 55, 72, 60].map((h, i) => (
              <div
                key={i}
                className="bg-muted animate-pulse rounded-t"
                style={{ width: '40px', height: `${h}%` }}
              />
            ))}
          </div>
        </div>

        {/* Two column skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="rounded-xl border bg-white p-5 space-y-4">
              <div className="h-5 w-40 bg-muted animate-pulse rounded" />
              <div className="h-3 w-56 bg-muted animate-pulse rounded" />
              <div className="h-72 bg-muted/40 animate-pulse rounded-lg" />
            </div>
          ))}
        </div>

        <p className="text-center text-sm text-muted-foreground animate-pulse">
          Loading branch data...
        </p>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-primary">Branch Performance</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Compare metrics across all {branches.length} branches
        </p>
      </div>

      {/* Row 1: Revenue bar chart (full width) */}
      <Card className="bg-white shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Monthly Revenue by Branch</CardTitle>
          <CardDescription>Current month revenue across all locations</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={revenueData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 11 }}
                  angle={-25}
                  textAnchor="end"
                  height={60}
                />
                <YAxis
                  tick={{ fontSize: 11 }}
                  tickFormatter={(val: number) => {
                    if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(1)}M`
                    if (val >= 1_000) return `${(val / 1_000).toFixed(0)}K`
                    return String(val)
                  }}
                  width={60}
                />
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                <Tooltip
                  formatter={(value: any) => [formatCurrency(Number(value)), 'Revenue']}
                  labelFormatter={(_label: any, payload: any) => {
                    if (payload && payload.length > 0 && payload[0].payload?.fullName) {
                      return payload[0].payload.fullName
                    }
                    return _label
                  }}
                />
                <Bar
                  dataKey="revenue"
                  fill={CHART_COLORS[0]}
                  radius={[4, 4, 0, 0]}
                  maxBarSize={60}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Row 2: Two columns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Retail vs Wholesale split */}
        <Card className="bg-white shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Retail vs Wholesale Revenue</CardTitle>
            <CardDescription>Revenue split by customer type per branch</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={splitData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 10 }}
                    angle={-25}
                    textAnchor="end"
                    height={60}
                  />
                  <YAxis
                    tick={{ fontSize: 10 }}
                    tickFormatter={(val: number) => {
                      if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(1)}M`
                      if (val >= 1_000) return `${(val / 1_000).toFixed(0)}K`
                      return String(val)
                    }}
                    width={55}
                  />
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  <Tooltip
                    formatter={(value: any, name: any) => [
                      formatCurrency(Number(value)),
                      name === 'retail' ? 'Retail' : 'Wholesale',
                    ]}
                    labelFormatter={(_label: any, payload: any) => {
                      if (payload && payload.length > 0 && payload[0].payload?.fullName) {
                        return payload[0].payload.fullName
                      }
                      return _label
                    }}
                  />
                  <Legend
                    formatter={(value: string) =>
                      value === 'retail' ? 'Retail' : 'Wholesale'
                    }
                  />
                  <Bar
                    dataKey="retail"
                    stackId="revenue"
                    fill={CHART_COLORS[0]}
                    radius={[0, 0, 0, 0]}
                    maxBarSize={50}
                  />
                  <Bar
                    dataKey="wholesale"
                    stackId="revenue"
                    fill={CHART_COLORS[1]}
                    radius={[4, 4, 0, 0]}
                    maxBarSize={50}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Average Basket Size */}
        <Card className="bg-white shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Average Basket Size</CardTitle>
            <CardDescription>Mean transaction value by branch</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={basketData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 10 }}
                    angle={-25}
                    textAnchor="end"
                    height={60}
                  />
                  <YAxis
                    tick={{ fontSize: 10 }}
                    tickFormatter={(val: number) => `${(val / 1000).toFixed(0)}K`}
                    width={45}
                  />
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  <Tooltip
                    formatter={(value: any) => [formatCurrency(Number(value)), 'Avg Basket']}
                    labelFormatter={(_label: any, payload: any) => {
                      if (payload && payload.length > 0 && payload[0].payload?.fullName) {
                        return payload[0].payload.fullName
                      }
                      return _label
                    }}
                  />
                  <Bar
                    dataKey="avg_basket"
                    fill={CHART_COLORS[2]}
                    radius={[4, 4, 0, 0]}
                    maxBarSize={60}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Row 3: Top categories per branch (table) */}
      <Card className="bg-white shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Top Categories by Branch</CardTitle>
          <CardDescription>Revenue for the top 5 product categories across branches</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-3 font-medium text-muted-foreground">
                    Category
                  </th>
                  {branches.map((b) => (
                    <th
                      key={b.branch_id}
                      className="text-right py-2 px-3 font-medium text-muted-foreground whitespace-nowrap"
                    >
                      {shortenBranchName(b.branch_name)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sortedCategories.map((row) => (
                  <tr key={row.category} className="border-b last:border-b-0 hover:bg-muted/30">
                    <td className="py-2 px-3 font-medium">{row.category}</td>
                    {branches.map((b) => {
                      const val = row.branchMap.get(b.branch_name)
                      return (
                        <td
                          key={b.branch_id}
                          className="text-right py-2 px-3 tabular-nums"
                        >
                          {val ? formatCurrency(val, true) : '--'}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Calapan callout */}
      <Card className="bg-blue-50/50 border-l-4 border-l-blue-500 shadow-sm">
        <CardContent className="p-5">
          <div className="flex items-start gap-3">
            <Info className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium text-sm text-blue-900">
                About Calapan Branch
              </p>
              <p className="text-sm text-blue-800 mt-1">
                Note: Citimart Island Mall (Calapan) operates in Oriental Mindoro, a separate
                province with different market dynamics than the Batangas branches. Revenue and
                basket size comparisons should account for these regional differences.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
