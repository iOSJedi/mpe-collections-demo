'use client'

import { useEffect, useState } from 'react'
import { apiFetch } from '@/lib/api'
import type { WorkflowEvent, WorkflowEventType } from '@/types'

// ─── Event Label Map ────────────────────────────────────────

const EVENT_LABELS: Record<WorkflowEventType, string> = {
  CLAIM_SUBMITTED: 'Claim Submitted',
  DELIVERY_REPORT_UPLOADED: 'Delivery Report Uploaded',
  GR_CONFIRMED: 'Goods Receipt Confirmed',
  INVOICE_SUBMITTED: 'Invoice Submitted',
  THREE_WAY_MATCH: '3-Way Match Verified',
  AP_CLERK_APPROVED: 'AP Clerk Approved',
  AP_CLERK_REJECTED: 'AP Clerk Rejected',
  FM_APPROVED: 'Finance Manager Approved',
  FM_REJECTED: 'Finance Manager Rejected',
  PAYMENT_SCHEDULED: 'Payment Scheduled',
  PAYMENT_RELEASED: 'Payment Released',
}

// ─── Types ──────────────────────────────────────────────────

interface TimelineResponse {
  events: WorkflowEvent[]
  currentStatus: string
  futureSteps: string[]
}

interface Props {
  supplierInvoiceId: number
}

// ─── Helpers ────────────────────────────────────────────────

function formatTimestamp(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

function formatWaitingSince(iso: string): string {
  const now = new Date()
  const then = new Date(iso)
  const diffMs = now.getTime() - then.getTime()
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffDays = Math.floor(diffHours / 24)

  if (diffDays > 1) return `Waiting for ${diffDays} days`
  if (diffDays === 1) return `Waiting for 1 day`
  if (diffHours > 1) return `Waiting for ${diffHours} hours`
  if (diffHours === 1) return `Waiting for 1 hour`
  return `Waiting since ${formatTimestamp(iso)}`
}

function getEventDescription(event: WorkflowEvent): string | null {
  if (!event.eventData) return null
  const data = event.eventData as Record<string, unknown>
  if (typeof data.description === 'string') return data.description
  if (typeof data.notes === 'string') return data.notes
  if (typeof data.reason === 'string') return data.reason
  if (typeof data.message === 'string') return data.message
  return null
}

function getPreviousStepLabel(futureSteps: string[], index: number, events: WorkflowEvent[]): string {
  if (index === 0 && events.length > 0) {
    const lastEvent = events[events.length - 1]
    return EVENT_LABELS[lastEvent.eventType] ?? lastEvent.eventType
  }
  return futureSteps[index - 1] ?? 'previous step'
}

// ─── Skeleton ───────────────────────────────────────────────

function TimelineSkeleton() {
  return (
    <div className="relative pl-8 space-y-6 animate-pulse">
      {/* vertical line placeholder */}
      <div className="absolute left-3 top-2 bottom-0 w-0.5 bg-[#2a2a2a]" />
      {[0, 1, 2].map((i) => (
        <div key={i} className="relative flex items-start gap-3">
          <div className="absolute -left-5 w-4 h-4 rounded-full bg-[#2a2a2a]" />
          <div className="flex-1 space-y-2 pt-0.5">
            <div className="h-3.5 w-40 rounded bg-[#2a2a2a]" />
            <div className="h-3 w-64 rounded bg-[#222]" />
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Component ──────────────────────────────────────────────

export default function WorkflowTimeline({ supplierInvoiceId }: Props) {
  const [data, setData] = useState<TimelineResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    apiFetch(`/api/payable/claims/${supplierInvoiceId}/timeline`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json() as Promise<TimelineResponse>
      })
      .then((json) => {
        if (!cancelled) {
          setData(json)
          setLoading(false)
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load timeline')
          setLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [supplierInvoiceId])

  if (loading) return <TimelineSkeleton />

  if (error) {
    return (
      <div className="text-sm text-red-400 px-2 py-3">
        Failed to load timeline: {error}
      </div>
    )
  }

  if (!data) return null

  const { events, futureSteps } = data

  const totalSteps = events.length + futureSteps.length
  const hasCompleted = events.length > 0
  const hasFuture = futureSteps.length > 0

  // Determine gradient stops for the vertical line
  const gradientId = `tl-grad-${supplierInvoiceId}`

  return (
    <div className="relative pl-8">
      {/* ── Vertical line ─────────────────────────────── */}
      {totalSteps > 1 && (
        <svg
          className="absolute left-3 top-2"
          style={{ width: 2, height: 'calc(100% - 1rem)' }}
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              {hasCompleted && <stop offset="0%" stopColor="#4ade80" />}
              {hasCompleted && hasFuture && (
                <stop
                  offset={`${Math.round((events.length / totalSteps) * 100)}%`}
                  stopColor="#f59e0b"
                />
              )}
              {hasFuture && <stop offset="100%" stopColor="#555" />}
              {!hasFuture && <stop offset="100%" stopColor="#4ade80" />}
            </linearGradient>
          </defs>
          <rect x="0" y="0" width="2" height="100%" fill={`url(#${gradientId})`} />
        </svg>
      )}

      <div className="space-y-5">
        {/* ── Completed events ──────────────────────────── */}
        {events.map((event) => {
          const label = EVENT_LABELS[event.eventType] ?? event.eventType
          const description = getEventDescription(event)
          const timestamp = formatTimestamp(event.createdAt)

          return (
            <div key={event.eventId} className="relative flex items-start gap-3">
              {/* Dot */}
              <div
                className="absolute -left-5 mt-0.5 w-4 h-4 rounded-full flex-shrink-0 ring-2 ring-black"
                style={{ backgroundColor: '#4ade80' }}
              />
              {/* Content */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white leading-tight">{label}</p>
                {description && (
                  <p className="text-xs text-[#aaa] mt-0.5 leading-snug">{description}</p>
                )}
                <p className="text-xs text-[#666] mt-1">
                  {timestamp}
                  {event.performedBy ? ` · by ${event.performedBy}` : ''}
                </p>
              </div>
            </div>
          )
        })}

        {/* ── Current / waiting step (last event acted as "current" when there are future steps) ── */}
        {/* Only show a "waiting" node if there are future steps and we have a last event time */}
        {hasFuture && hasCompleted && (() => {
          const lastEvent = events[events.length - 1]
          const waitingLabel = futureSteps[0]
          return (
            <div className="relative flex items-start gap-3">
              {/* Pulsing amber dot */}
              <div className="absolute -left-5 mt-0.5 flex-shrink-0">
                <span
                  className="block w-4 h-4 rounded-full animate-pulse ring-2 ring-black"
                  style={{
                    backgroundColor: '#f59e0b',
                    boxShadow: '0 0 8px 2px rgba(245,158,11,0.5)',
                  }}
                />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium" style={{ color: '#f59e0b' }}>
                  {waitingLabel}
                </p>
                <p className="text-xs mt-1" style={{ color: '#b45309' }}>
                  {formatWaitingSince(lastEvent.createdAt)}
                </p>
              </div>
            </div>
          )
        })()}

        {/* ── Future steps ─────────────────────────────── */}
        {futureSteps.slice(hasCompleted ? 1 : 0).map((step, idx) => {
          const realIndex = hasCompleted ? idx + 1 : idx
          const prevLabel = getPreviousStepLabel(futureSteps, realIndex, events)
          return (
            <div key={`future-${idx}`} className="relative flex items-start gap-3 opacity-50">
              {/* Grey dot */}
              <div
                className="absolute -left-5 mt-0.5 w-4 h-4 rounded-full flex-shrink-0 ring-2 ring-black"
                style={{ backgroundColor: '#555' }}
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[#888]">{step}</p>
                <p className="text-xs text-[#555] mt-0.5">Pending {prevLabel}</p>
              </div>
            </div>
          )
        })}

        {/* ── Empty state ───────────────────────────────── */}
        {events.length === 0 && futureSteps.length === 0 && (
          <p className="text-sm text-[#666] px-1">No workflow events yet.</p>
        )}
      </div>
    </div>
  )
}
