'use client'

import { useEffect, useCallback, useRef, useState } from 'react'
import Link from 'next/link'
import { Search, ChevronLeft, ChevronRight, Users } from 'lucide-react'
import { useAppDispatch, useAppSelector } from '@/store'
import {
  setCustomers,
  setCustomerLoading,
  setCustomerFilters,
} from '@/store/slices/customerSlice'
import { apiFetch } from '@/lib/api'
import { formatCurrency } from '@/lib/utils'
import type { CustomerSummary } from '@/types'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const PAGE_SIZE = 50

const SEGMENTS = [
  'High-Value Loyalist',
  'At-Risk Big Spender',
  'Steady Mid-Tier',
  'Bargain Hunter',
  'New & Promising',
  'Dormant',
]

function ChurnDot({ risk }: { risk: string | null }) {
  const colors: Record<string, string> = {
    low: 'bg-green-500',
    medium: 'bg-yellow-500',
    high: 'bg-orange-500',
    critical: 'bg-red-500',
  }
  const color = risk ? colors[risk.toLowerCase()] ?? 'bg-gray-300' : 'bg-gray-300'
  const label = risk ? risk.charAt(0).toUpperCase() + risk.slice(1) : 'Unknown'
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
      <span className={`inline-block h-2 w-2 rounded-full ${color}`} />
      {label}
    </span>
  )
}

function TypeBadge({ type }: { type: CustomerSummary['customer_type'] }) {
  const variants: Record<string, 'outline' | 'default' | 'secondary'> = {
    retail: 'outline',
    wholesale: 'default',
    both: 'secondary',
  }
  return (
    <Badge variant={variants[type] ?? 'outline'} className="capitalize text-[11px]">
      {type}
    </Badge>
  )
}

function SegmentBadge({ segment }: { segment: string }) {
  const colorMap: Record<string, string> = {
    'High-Value Loyalist': 'bg-emerald-100 text-emerald-800 border-emerald-200',
    'At-Risk Big Spender': 'bg-red-100 text-red-800 border-red-200',
    'Steady Mid-Tier': 'bg-blue-100 text-blue-800 border-blue-200',
    'Bargain Hunter': 'bg-amber-100 text-amber-800 border-amber-200',
    'New & Promising': 'bg-violet-100 text-violet-800 border-violet-200',
    'Dormant': 'bg-gray-100 text-gray-600 border-gray-200',
  }
  const cls = colorMap[segment] ?? 'bg-gray-100 text-gray-600 border-gray-200'
  return (
    <Badge variant="outline" className={`text-[11px] ${cls}`}>
      {segment}
    </Badge>
  )
}

const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

export function CustomerList() {
  const dispatch = useAppDispatch()
  const { customers, loading, filters, lastFetched } = useAppSelector((state) => state.customer)
  const [total, setTotal] = useState(0)
  const [offset, setOffset] = useState(0)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const fetchCustomers = useCallback(
    async (currentFilters: typeof filters, currentOffset: number) => {
      dispatch(setCustomerLoading(true))
      try {
        const params = new URLSearchParams()
        if (currentFilters.type !== 'all') params.set('type', currentFilters.type)
        if (currentFilters.segment) params.set('segment', currentFilters.segment)
        if (currentFilters.search) params.set('search', currentFilters.search)
        params.set('limit', String(PAGE_SIZE))
        params.set('offset', String(currentOffset))

        const res = await apiFetch(`/api/customers?${params.toString()}`)
        if (!res.ok) throw new Error('Failed to fetch customers')
        const data = await res.json()
        dispatch(setCustomers(data.customers))
        setTotal(data.total)
      } catch (err) {
        console.error('Error fetching customers:', err)
      } finally {
        dispatch(setCustomerLoading(false))
      }
    },
    [dispatch]
  )

  // Fetch on mount (skip if cached)
  useEffect(() => {
    if (lastFetched && Date.now() - lastFetched < CACHE_TTL && customers.length > 0) return
    fetchCustomers(filters, 0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Fetch when filters change (debounced for search)
  const handleFilterChange = useCallback(
    (newFilters: Partial<typeof filters>) => {
      dispatch(setCustomerFilters(newFilters))
      const merged = { ...filters, ...newFilters }
      setOffset(0)

      if (debounceRef.current) clearTimeout(debounceRef.current)
      const delay = 'search' in newFilters ? 400 : 0
      debounceRef.current = setTimeout(() => {
        fetchCustomers(merged, 0)
      }, delay)
    },
    [dispatch, filters, fetchCustomers]
  )

  const handlePageChange = useCallback(
    (newOffset: number) => {
      setOffset(newOffset)
      fetchCustomers(filters, newOffset)
    },
    [filters, fetchCustomers]
  )

  const showingFrom = total === 0 ? 0 : offset + 1
  const showingTo = Math.min(offset + PAGE_SIZE, total)
  const hasPrev = offset > 0
  const hasNext = offset + PAGE_SIZE < total

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-primary">Customers</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Browse and search customer profiles
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, business, or ID..."
            value={filters.search}
            onChange={(e) => handleFilterChange({ search: e.target.value })}
            className="pl-9"
          />
        </div>
        <Select
          value={filters.type}
          onValueChange={(val) =>
            handleFilterChange({ type: val as typeof filters.type })
          }
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Customer type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="retail">Retail</SelectItem>
            <SelectItem value="wholesale">Wholesale</SelectItem>
            <SelectItem value="both">Both</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={filters.segment || 'all'}
          onValueChange={(val) =>
            handleFilterChange({ segment: val === 'all' ? '' : val })
          }
        >
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Segment" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Segments</SelectItem>
            {SEGMENTS.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Results count */}
      <div className="text-sm text-muted-foreground">
        {loading
          ? 'Loading...'
          : total === 0
            ? 'No customers found'
            : `Showing ${showingFrom}\u2013${showingTo} of ${total.toLocaleString()} customers`}
      </div>

      {/* Customer cards / table */}
      {loading && customers.length === 0 ? (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="rounded-xl border bg-white p-4">
              <div className="hidden lg:grid lg:grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr_auto] gap-4 items-center">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <div className="h-4 w-32 bg-muted animate-pulse rounded" />
                    <div className="h-5 w-14 bg-muted animate-pulse rounded-full" />
                  </div>
                  <div className="h-3 w-24 bg-muted animate-pulse rounded" />
                </div>
                <div className="h-5 w-24 bg-muted animate-pulse rounded-full" />
                <div className="flex items-center gap-1.5">
                  <div className="h-2 w-2 bg-muted animate-pulse rounded-full" />
                  <div className="h-3 w-14 bg-muted animate-pulse rounded" />
                </div>
                <div className="h-4 w-16 bg-muted animate-pulse rounded ml-auto" />
                <div className="h-4 w-10 bg-muted animate-pulse rounded ml-auto" />
                <div className="h-3 w-20 bg-muted animate-pulse rounded" />
                <div className="h-8 w-20 bg-muted animate-pulse rounded" />
              </div>
              {/* Mobile skeleton */}
              <div className="lg:hidden space-y-3">
                <div className="flex items-center gap-2">
                  <div className="h-4 w-32 bg-muted animate-pulse rounded" />
                  <div className="h-5 w-14 bg-muted animate-pulse rounded-full" />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="h-8 bg-muted animate-pulse rounded" />
                  <div className="h-8 bg-muted animate-pulse rounded" />
                  <div className="h-8 bg-muted animate-pulse rounded" />
                </div>
              </div>
            </div>
          ))}
          <p className="text-center text-sm text-muted-foreground animate-pulse pt-2">
            Loading customers...
          </p>
        </div>
      ) : customers.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No customers match your filters. Try adjusting the search or filter criteria.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {/* Table header (desktop) */}
          <div className="hidden lg:grid lg:grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr_auto] gap-4 px-4 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
            <div>Customer</div>
            <div>Segment</div>
            <div>Churn Risk</div>
            <div className="text-right">Total Spend</div>
            <div className="text-right">Transactions</div>
            <div>Last Transaction</div>
            <div />
          </div>

          {customers.map((c) => (
            <Card
              key={c.customer_id}
              className="hover:shadow-md transition-shadow"
            >
              <CardContent className="p-4">
                {/* Desktop row */}
                <div className="hidden lg:grid lg:grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr_auto] gap-4 items-center">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm truncate">
                        {c.first_name} {c.last_name}
                      </span>
                      <TypeBadge type={c.customer_type} />
                    </div>
                    {c.business_name && (
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        {c.business_name}
                      </p>
                    )}
                  </div>
                  <div>
                    {c.segment_name ? (
                      <SegmentBadge segment={c.segment_name} />
                    ) : (
                      <span className="text-xs text-muted-foreground">&mdash;</span>
                    )}
                  </div>
                  <div>
                    <ChurnDot risk={c.churn_risk} />
                  </div>
                  <div className="text-right text-sm font-medium">
                    {formatCurrency(c.total_spend, true)}
                  </div>
                  <div className="text-right text-sm text-muted-foreground">
                    {c.transaction_count.toLocaleString()}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {c.last_transaction_date
                      ? new Date(c.last_transaction_date).toLocaleDateString('en-PH', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })
                      : '\u2014'}
                  </div>
                  <div>
                    <Link href={`/customers/${c.customer_id}`}>
                      <Button variant="ghost" size="sm" className="text-xs">
                        View Profile
                      </Button>
                    </Link>
                  </div>
                </div>

                {/* Mobile card */}
                <div className="lg:hidden space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium">
                          {c.first_name} {c.last_name}
                        </span>
                        <TypeBadge type={c.customer_type} />
                      </div>
                      {c.business_name && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {c.business_name}
                        </p>
                      )}
                    </div>
                    <ChurnDot risk={c.churn_risk} />
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {c.segment_name && <SegmentBadge segment={c.segment_name} />}
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <div>
                      <p className="text-xs text-muted-foreground">Spend</p>
                      <p className="font-medium">{formatCurrency(c.total_spend, true)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Transactions</p>
                      <p className="font-medium">{c.transaction_count.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Last Txn</p>
                      <p className="font-medium">
                        {c.last_transaction_date
                          ? new Date(c.last_transaction_date).toLocaleDateString(
                              'en-PH',
                              { month: 'short', day: 'numeric' }
                            )
                          : '\u2014'}
                      </p>
                    </div>
                  </div>
                  <Link href={`/customers/${c.customer_id}`}>
                    <Button variant="outline" size="sm" className="w-full text-xs">
                      View Profile
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Pagination */}
      {total > PAGE_SIZE && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-sm text-muted-foreground">
            Page {Math.floor(offset / PAGE_SIZE) + 1} of{' '}
            {Math.ceil(total / PAGE_SIZE)}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={!hasPrev || loading}
              onClick={() => handlePageChange(offset - PAGE_SIZE)}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!hasNext || loading}
              onClick={() => handlePageChange(offset + PAGE_SIZE)}
            >
              Next
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
