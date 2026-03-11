'use client'

import { DollarSign, AlertTriangle, Clock, TrendingUp } from 'lucide-react'
import { KPICard } from '@/components/dashboard/KPICard'
import { formatCurrency } from '@/lib/utils'
import type { OverviewKPIs } from '@/types'

interface OverviewKPIsProps {
  kpis: OverviewKPIs
}

export function OverviewKPIsComponent({ kpis }: OverviewKPIsProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <KPICard
        title="Total Receivables"
        value={formatCurrency(kpis.total_receivables, true)}
        subtitle="Unpaid invoice balances"
        icon={<DollarSign className="h-5 w-5 text-emerald-600" />}
      />
      <KPICard
        title="Overdue Receivables"
        value={formatCurrency(kpis.overdue_receivables, true)}
        subtitle="Past due date"
        icon={<AlertTriangle className="h-5 w-5 text-amber-500" />}
      />
      <KPICard
        title="Days Sales Outstanding"
        value={`${kpis.dso} days`}
        subtitle="Avg. time to collect"
        icon={<Clock className="h-5 w-5 text-blue-500" />}
      />
      <KPICard
        title="Collection Rate"
        value={`${(kpis.collection_rate * 100).toFixed(1)}%`}
        subtitle="Paid vs. total invoices"
        icon={<TrendingUp className="h-5 w-5 text-emerald-600" />}
      />
    </div>
  )
}
