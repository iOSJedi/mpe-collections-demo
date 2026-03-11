'use client'

import { useEffect, useCallback, useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  Phone,
  Mail,
  MapPin,
  CreditCard,
  Store,
  ShoppingCart,
  TrendingUp,
  AlertTriangle,
  Star,
  Package,
  Calendar,
  Wallet,
} from 'lucide-react'
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts'
import { useAppDispatch, useAppSelector } from '@/store'
import {
  setSelectedCustomer,
  setCustomerLoading,
} from '@/store/slices/customerSlice'
import { apiFetch } from '@/lib/api'
import { formatCurrency } from '@/lib/utils'
import type { CustomerProfile } from '@/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

// ---- Chart color constants (CSS variable-based) ----
const CHART_COLORS = [
  'hsl(216, 47%, 20%)',   // chart-1
  'hsl(189, 53%, 36%)',   // chart-2
  'hsl(45, 100%, 51%)',   // chart-3
  'hsl(354, 70%, 54%)',   // chart-4
  'hsl(134, 61%, 41%)',   // chart-5
]

// ---- Helper components ----

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
    <span className="inline-flex items-center gap-1.5">
      <span className={`inline-block h-2.5 w-2.5 rounded-full ${color}`} />
      <span className="text-sm">{label} risk</span>
    </span>
  )
}

function TypeBadge({ type }: { type: CustomerProfile['customer_type'] }) {
  const variants: Record<string, 'outline' | 'default' | 'secondary'> = {
    retail: 'outline',
    wholesale: 'default',
    both: 'secondary',
  }
  return (
    <Badge variant={variants[type] ?? 'outline'} className="capitalize">
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
    <Badge variant="outline" className={cls}>
      {segment}
    </Badge>
  )
}

function StatCard({
  label,
  value,
  icon,
  subtext,
}: {
  label: string
  value: string
  icon: React.ReactNode
  subtext?: string
}) {
  return (
    <Card className="bg-white shadow-sm">
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="space-y-1 min-w-0 flex-1">
            <p className="text-xs font-medium text-muted-foreground">{label}</p>
            <p className="text-lg font-bold text-primary truncate">{value}</p>
            {subtext && (
              <p className="text-xs text-muted-foreground">{subtext}</p>
            )}
          </div>
          <div className="rounded-lg bg-secondary/10 p-2 text-secondary flex-shrink-0">
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ---- Currency formatter for chart tooltips ----
function currencyTooltipFormatter(value: number | undefined) {
  return value != null ? formatCurrency(value) : '\u2014'
}

// ---- Main component ----

export function CustomerDNA({ customerId }: { customerId: string }) {
  const dispatch = useAppDispatch()
  const { selectedCustomer: customer, loading } = useAppSelector(
    (state) => state.customer
  )
  const [error, setError] = useState<string | null>(null)

  const fetchProfile = useCallback(async () => {
    dispatch(setCustomerLoading(true))
    setError(null)
    try {
      const res = await apiFetch(`/api/customers/${customerId}`)
      if (!res.ok) {
        if (res.status === 404) throw new Error('Customer not found')
        throw new Error('Failed to load customer')
      }
      const data = await res.json()
      dispatch(setSelectedCustomer(data.customer))
    } catch (err) {
      console.error('Error fetching customer:', err)
      setError(err instanceof Error ? err.message : 'Failed to load customer')
    } finally {
      dispatch(setCustomerLoading(false))
    }
  }, [customerId, dispatch])

  useEffect(() => {
    fetchProfile()
    return () => {
      dispatch(setSelectedCustomer(null))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerId])

  if (loading && !customer) {
    return (
      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        {/* Back button skeleton */}
        <div className="h-8 w-36 bg-muted animate-pulse rounded" />

        {/* Profile header skeleton */}
        <div className="rounded-xl border bg-white p-6 space-y-4">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="h-7 w-48 bg-muted animate-pulse rounded" />
                <div className="h-6 w-16 bg-muted animate-pulse rounded-full" />
              </div>
              <div className="h-4 w-32 bg-muted animate-pulse rounded" />
              <div className="flex items-center gap-3">
                <div className="h-6 w-28 bg-muted animate-pulse rounded-full" />
                <div className="h-4 w-20 bg-muted animate-pulse rounded" />
              </div>
            </div>
            <div className="flex gap-6">
              <div className="space-y-1 text-right">
                <div className="h-3 w-20 bg-muted animate-pulse rounded ml-auto" />
                <div className="h-7 w-24 bg-muted animate-pulse rounded ml-auto" />
              </div>
              <div className="space-y-1 text-right">
                <div className="h-3 w-20 bg-muted animate-pulse rounded ml-auto" />
                <div className="h-7 w-16 bg-muted animate-pulse rounded ml-auto" />
              </div>
            </div>
          </div>
        </div>

        {/* Tabs skeleton */}
        <div className="h-10 w-96 bg-muted animate-pulse rounded-lg" />

        {/* Stat cards skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-xl border bg-white p-4 space-y-2">
              <div className="h-3 w-20 bg-muted animate-pulse rounded" />
              <div className="h-6 w-24 bg-muted animate-pulse rounded" />
              <div className="h-3 w-16 bg-muted animate-pulse rounded" />
            </div>
          ))}
        </div>

        <p className="text-center text-sm text-muted-foreground animate-pulse">
          Loading customer profile...
        </p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6 space-y-4">
        <Link href="/customers">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-1" /> Back to Customers
          </Button>
        </Link>
        <Card>
          <CardContent className="py-12 text-center">
            <AlertTriangle className="h-8 w-8 mx-auto text-destructive mb-3" />
            <p className="text-destructive font-medium">{error}</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!customer) return null

  const c = customer

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Back button */}
      <Link href="/customers">
        <Button variant="ghost" size="sm" className="text-muted-foreground -ml-2">
          <ArrowLeft className="h-4 w-4 mr-1" /> Back to Customers
        </Button>
      </Link>

      {/* Profile Header */}
      <ProfileHeader customer={c} />

      {/* Tabbed Sections */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4 max-w-lg">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="purchase">Purchase Behavior</TabsTrigger>
          <TabsTrigger value="basket">Basket Patterns</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <OverviewTab customer={c} />
        </TabsContent>

        <TabsContent value="purchase">
          <PurchaseBehaviorTab customer={c} />
        </TabsContent>

        <TabsContent value="basket">
          <BasketPatternsTab customer={c} />
        </TabsContent>

        <TabsContent value="timeline">
          <TimelineTab customer={c} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

// ---- Profile Header ----

function ProfileHeader({ customer: c }: { customer: CustomerProfile }) {
  const isBoth = c.customer_type === 'both'

  return (
    <Card className="overflow-hidden">
      {/* Dual-identity hero for "both" type */}
      {isBoth && (
        <div className="bg-gradient-to-r from-primary/10 via-secondary/10 to-primary/10 border-b px-6 py-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <div className="rounded-full bg-primary/20 p-2">
                <CreditCard className="h-5 w-5 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium text-primary uppercase tracking-wide">
                  Retail Identity
                </p>
                <p className="font-semibold text-sm truncate">
                  {c.first_name} {c.last_name}
                  {c.loyalty_card_number && (
                    <span className="text-muted-foreground font-normal">
                      {' '}&middot; {c.loyalty_card_number}
                    </span>
                  )}
                </p>
              </div>
            </div>
            <div className="hidden sm:block text-2xl font-light text-muted-foreground/40">
              +
            </div>
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <div className="rounded-full bg-secondary/20 p-2">
                <Store className="h-5 w-5 text-secondary" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium text-secondary uppercase tracking-wide">
                  Wholesale Identity
                </p>
                <p className="font-semibold text-sm truncate">
                  {c.business_name || 'Business'}
                  {c.wholesale_member_id && (
                    <span className="text-muted-foreground font-normal">
                      {' '}&middot; {c.wholesale_member_id}
                    </span>
                  )}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      <CardContent className="p-6">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          {/* Name and badges */}
          <div className="space-y-2">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold text-primary">
                {c.first_name} {c.last_name}
              </h1>
              <TypeBadge type={c.customer_type} />
            </div>
            {!isBoth && c.business_name && (
              <p className="text-sm text-muted-foreground">
                <Store className="inline h-3.5 w-3.5 mr-1" />
                {c.business_name}
                {c.wholesale_member_id && ` (${c.wholesale_member_id})`}
              </p>
            )}
            {!isBoth && c.loyalty_card_number && (
              <p className="text-sm text-muted-foreground">
                <CreditCard className="inline h-3.5 w-3.5 mr-1" />
                {c.loyalty_card_number}
              </p>
            )}
            <div className="flex items-center gap-3 flex-wrap">
              {c.segment_name && <SegmentBadge segment={c.segment_name} />}
              <ChurnDot risk={c.churn_risk} />
            </div>
          </div>

          {/* Key metrics */}
          <div className="flex gap-6 text-right">
            <div>
              <p className="text-xs text-muted-foreground">Lifetime Spend</p>
              <p className="text-xl font-bold text-primary">
                {formatCurrency(c.total_spend, true)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Transactions</p>
              <p className="text-xl font-bold text-primary">
                {c.transaction_count.toLocaleString()}
              </p>
            </div>
          </div>
        </div>

        {/* Contact info */}
        <div className="flex flex-wrap gap-4 mt-4 pt-4 border-t text-sm text-muted-foreground">
          {c.phone && (
            <span className="inline-flex items-center gap-1.5">
              <Phone className="h-3.5 w-3.5" /> {c.phone}
            </span>
          )}
          {c.email && (
            <span className="inline-flex items-center gap-1.5">
              <Mail className="h-3.5 w-3.5" /> {c.email}
            </span>
          )}
          {c.municipality && (
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5" />
              {c.barangay ? `${c.barangay}, ` : ''}{c.municipality}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

// ---- Overview Tab ----

function OverviewTab({ customer: c }: { customer: CustomerProfile }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      <StatCard
        label="Lifetime Spend"
        value={formatCurrency(c.total_spend)}
        icon={<Wallet className="h-5 w-5" />}
        subtext={`${c.transaction_count} transactions`}
      />
      <StatCard
        label="Visit Frequency"
        value={c.rfm_frequency != null ? `${c.rfm_frequency} / period` : '\u2014'}
        icon={<ShoppingCart className="h-5 w-5" />}
        subtext={c.rfm_recency != null ? `Recency score: ${c.rfm_recency}` : undefined}
      />
      <StatCard
        label="RFM Monetary"
        value={c.rfm_monetary != null ? String(c.rfm_monetary) : '\u2014'}
        icon={<TrendingUp className="h-5 w-5" />}
      />
      <StatCard
        label="Churn Risk"
        value={c.churn_risk ?? 'Unknown'}
        icon={<AlertTriangle className="h-5 w-5" />}
        subtext={
          c.churn_probability != null
            ? `${(c.churn_probability * 100).toFixed(1)}% probability`
            : c.top_risk_factor ?? undefined
        }
      />
      {c.credit_limit != null && (
        <StatCard
          label="Credit Limit"
          value={formatCurrency(c.credit_limit)}
          icon={<CreditCard className="h-5 w-5" />}
          subtext={
            c.credit_utilization != null
              ? `${(c.credit_utilization * 100).toFixed(1)}% utilized`
              : undefined
          }
        />
      )}
      {c.outstanding_balance != null && (
        <StatCard
          label="Outstanding Balance"
          value={formatCurrency(c.outstanding_balance)}
          icon={<Wallet className="h-5 w-5" />}
          subtext={c.credit_risk_level ? `Risk: ${c.credit_risk_level}` : undefined}
        />
      )}
      <StatCard
        label="Member Since"
        value={
          c.registration_date
            ? new Date(c.registration_date).toLocaleDateString('en-PH', {
                month: 'long',
                year: 'numeric',
              })
            : '\u2014'
        }
        icon={<Calendar className="h-5 w-5" />}
        subtext={`Status: ${c.status}`}
      />
      {c.last_transaction_date && (
        <StatCard
          label="Last Transaction"
          value={new Date(c.last_transaction_date).toLocaleDateString('en-PH', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          })}
          icon={<Calendar className="h-5 w-5" />}
        />
      )}
    </div>
  )
}

// ---- Purchase Behavior Tab ----

function PurchaseBehaviorTab({ customer: c }: { customer: CustomerProfile }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top categories */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Top Categories by Spend</CardTitle>
          </CardHeader>
          <CardContent>
            {c.top_categories.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">
                No category data available
              </p>
            ) : (
              <ResponsiveContainer width="100%" height={Math.max(200, c.top_categories.length * 36)}>
                <BarChart
                  data={c.top_categories}
                  layout="vertical"
                  margin={{ top: 0, right: 20, bottom: 0, left: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" tickFormatter={(v: number) => formatCurrency(v, true)} tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="category" width={100} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={currencyTooltipFormatter} />
                  <Bar dataKey="total" radius={[0, 4, 4, 0]}>
                    {c.top_categories.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Top brands */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Top Brands by Frequency</CardTitle>
          </CardHeader>
          <CardContent>
            {c.top_brands.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">
                No brand data available
              </p>
            ) : (
              <ResponsiveContainer width="100%" height={Math.max(200, c.top_brands.length * 36)}>
                <BarChart
                  data={c.top_brands}
                  layout="vertical"
                  margin={{ top: 0, right: 20, bottom: 0, left: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="brand" width={100} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                    {c.top_brands.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[(i + 1) % CHART_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Monthly spending trend */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Monthly Spending Trend</CardTitle>
        </CardHeader>
        <CardContent>
          {c.monthly_spend.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              No monthly spending data available
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart
                data={c.monthly_spend}
                margin={{ top: 10, right: 20, bottom: 0, left: 10 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 11 }}
                  tickFormatter={(m: string) => {
                    const [year, month] = m.split('-')
                    const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
                    return `${monthNames[parseInt(month, 10) - 1]} ${year.slice(2)}`
                  }}
                />
                <YAxis tickFormatter={(v: number) => formatCurrency(v, true)} tick={{ fontSize: 11 }} />
                <Tooltip formatter={currencyTooltipFormatter} />
                <Line
                  type="monotone"
                  dataKey="total"
                  stroke={CHART_COLORS[1]}
                  strokeWidth={2}
                  dot={{ r: 4, fill: CHART_COLORS[1] }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// ---- Basket Patterns Tab ----

function BasketPatternsTab({ customer: c }: { customer: CustomerProfile }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Most frequently purchased */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Package className="h-4 w-4" />
            Most Frequently Purchased
          </CardTitle>
        </CardHeader>
        <CardContent>
          {c.top_brands.length === 0 && c.top_categories.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              No purchase data available
            </p>
          ) : (
            <div className="space-y-2">
              {c.top_categories.map((cat, i) => (
                <div
                  key={cat.category}
                  className="flex items-center justify-between py-2 border-b last:border-b-0"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-muted-foreground w-5 text-right">
                      {i + 1}.
                    </span>
                    <span className="text-sm">{cat.category}</span>
                  </div>
                  <span className="text-sm font-medium text-primary">
                    {formatCurrency(cat.total, true)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recommended products */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Star className="h-4 w-4" />
            Recommended Products
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Customers who buy what you buy also buy...
          </p>
        </CardHeader>
        <CardContent>
          {c.recommended_products.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              Not enough data to generate recommendations yet
            </p>
          ) : (
            <div className="space-y-2">
              {c.recommended_products.map((prod) => (
                <div
                  key={prod.product_name}
                  className="flex items-center justify-between py-2 border-b last:border-b-0"
                >
                  <span className="text-sm">{prod.product_name}</span>
                  <div className="flex items-center gap-2">
                    <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full bg-secondary"
                        style={{ width: `${Math.min(prod.confidence * 100, 100)}%` }}
                      />
                    </div>
                    <span className="text-xs text-muted-foreground w-10 text-right">
                      {(prod.confidence * 100).toFixed(0)}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// ---- Timeline Tab ----

function TimelineTab({ customer: c }: { customer: CustomerProfile }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Transaction History</CardTitle>
        <p className="text-xs text-muted-foreground">
          Recent transactions (most recent first)
        </p>
      </CardHeader>
      <CardContent>
        {c.recent_transactions.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">
            No transactions found
          </p>
        ) : (
          <div className="space-y-0">
            {c.recent_transactions.map((txn, i) => {
              const isRetail = txn.transaction_type === 'retail'
              const borderColor = isRetail
                ? 'border-l-blue-500'
                : 'border-l-orange-500'
              const bgColor = isRetail
                ? 'bg-blue-50/50'
                : 'bg-orange-50/50'

              return (
                <div
                  key={txn.transaction_id}
                  className={`flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 py-3 px-4 border-l-4 ${borderColor} ${bgColor} ${
                    i < c.recent_transactions.length - 1 ? 'border-b' : ''
                  }`}
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="text-sm text-muted-foreground w-24 flex-shrink-0">
                      {new Date(txn.date).toLocaleDateString('en-PH', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">
                        {txn.branch_name}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 sm:flex-shrink-0">
                    <Badge
                      variant={isRetail ? 'outline' : 'default'}
                      className="text-[11px] capitalize"
                    >
                      {txn.transaction_type}
                    </Badge>
                    <span className="text-sm font-medium text-primary w-24 text-right">
                      {formatCurrency(txn.total_amount)}
                    </span>
                    <span className="text-xs text-muted-foreground w-16 text-right">
                      {txn.items_count} item{txn.items_count !== 1 ? 's' : ''}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
