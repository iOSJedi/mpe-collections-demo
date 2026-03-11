'use client'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency } from '@/lib/utils'

export interface AgingBucket {
  bucket: string
  amount: number
}

interface AgingChartProps {
  data: AgingBucket[]
}

const BUCKET_COLORS: Record<string, string> = {
  'Current': '#22c55e',       // green-500
  '1-30 days': '#f59e0b',     // amber-500
  '31-60 days': '#f97316',    // orange-500
  '61-90 days': '#ef4444',    // red-500 (slightly orange-red)
  '90+ days': '#dc2626',      // red-600
}

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: { value: number }[]
  label?: string
}) {
  if (!active || !payload?.length) return null

  return (
    <div className="rounded-lg border bg-white px-3 py-2 shadow-md text-sm">
      <p className="font-semibold text-foreground">{label}</p>
      <p className="text-muted-foreground">{formatCurrency(payload[0].value, true)}</p>
    </div>
  )
}

export function AgingChart({ data }: AgingChartProps) {
  return (
    <Card className="bg-white shadow-sm h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold text-primary">
          AR Aging Buckets
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Outstanding receivables by days overdue
        </p>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={data} margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis
              dataKey="bucket"
              tick={{ fontSize: 12, fill: '#6b7280' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tickFormatter={(v) => formatCurrency(v, true)}
              tick={{ fontSize: 11, fill: '#6b7280' }}
              axisLine={false}
              tickLine={false}
              width={72}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
            <Bar dataKey="amount" radius={[4, 4, 0, 0]}>
              {data.map((entry) => (
                <Cell
                  key={entry.bucket}
                  fill={BUCKET_COLORS[entry.bucket] ?? '#6b7280'}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
