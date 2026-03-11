'use client'

import { ReactNode } from 'react'
import { TrendingUp, TrendingDown } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { cn, formatPercent } from '@/lib/utils'

interface KPICardProps {
  title: string
  value: string
  change?: number
  subtitle?: string
  icon?: ReactNode
}

export function KPICard({ title, value, change, subtitle, icon }: KPICardProps) {
  const isPositive = change !== undefined && change >= 0
  const isNegative = change !== undefined && change < 0

  return (
    <Card className="bg-white shadow-sm hover:shadow-md transition-shadow">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold tracking-tight text-primary">
              {value}
            </p>
          </div>
          {icon && (
            <div className="rounded-lg bg-secondary/10 p-2.5 text-secondary">
              {icon}
            </div>
          )}
        </div>

        {(change !== undefined || subtitle) && (
          <div className="mt-3 flex items-center gap-1.5 text-sm">
            {change !== undefined && (
              <>
                {isPositive && (
                  <TrendingUp className="h-4 w-4 text-success" />
                )}
                {isNegative && (
                  <TrendingDown className="h-4 w-4 text-destructive" />
                )}
                <span
                  className={cn(
                    'font-medium',
                    isPositive && 'text-success',
                    isNegative && 'text-destructive'
                  )}
                >
                  {formatPercent(change)}
                </span>
              </>
            )}
            {subtitle && (
              <span className="text-muted-foreground">{subtitle}</span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
