'use client'

import { useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { ArrowRight } from 'lucide-react'
import type { InsightCard } from '@/types'

const severityConfig = {
  alert: {
    dotColor: 'bg-destructive',
    badgeVariant: 'destructive' as const,
    label: 'Alert',
  },
  warning: {
    dotColor: 'bg-warning',
    badgeVariant: 'warning' as const,
    label: 'Warning',
  },
  opportunity: {
    dotColor: 'bg-success',
    badgeVariant: 'success' as const,
    label: 'Opportunity',
  },
  info: {
    dotColor: 'bg-info',
    badgeVariant: 'default' as const,
    label: 'Info',
  },
}

interface InsightCardComponentProps {
  insight: InsightCard
}

export function InsightCardComponent({ insight }: InsightCardComponentProps) {
  const router = useRouter()
  const config = severityConfig[insight.severity] || severityConfig.info

  const handleDigDeeper = () => {
    const question = insight.related_intent
      ? `Tell me more about: ${insight.title}`
      : `Explain this insight: ${insight.title}`
    router.push(`/chat?q=${encodeURIComponent(question)}`)
  }

  return (
    <Card className="bg-white shadow-sm hover:shadow-md transition-shadow">
      <CardContent className="p-5">
        <div className="flex items-start gap-3">
          <span
            className={cn(
              'mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full',
              config.dotColor
            )}
            aria-hidden="true"
          />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-foreground leading-snug">
                {insight.title}
              </h3>
              <Badge variant={config.badgeVariant} className="shrink-0 text-[11px]">
                {config.label}
              </Badge>
            </div>

            <p className="text-sm text-muted-foreground leading-relaxed">
              {insight.body}
            </p>

            {insight.action && (
              <p className="text-sm italic text-secondary">
                {insight.action}
              </p>
            )}

            <button
              onClick={handleDigDeeper}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-secondary hover:text-secondary/80 transition-colors pt-1"
            >
              Dig Deeper
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
