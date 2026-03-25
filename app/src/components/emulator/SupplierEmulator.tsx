'use client'

import { useEffect, useState, useCallback } from 'react'
import { useAppDispatch, useAppSelector } from '@/store'
import { setSelectedSupplier, setSelectedPo } from '@/store/slices/emulatorSlice'
import { apiFetch } from '@/lib/api'
import type { SupplierSummary, POSummary, ClaimSummary, WorkflowEvent, WorkflowStatus, POMilestone } from '@/types'

// ─── Helpers ────────────────────────────────────────────────

function workflowBadgeClass(status: WorkflowStatus): string {
  switch (status) {
    case 'SUBMITTED': return 'bg-blue-100 text-blue-700 border border-blue-200'
    case 'GR_CONFIRMED': return 'bg-cyan-100 text-cyan-700 border border-cyan-200'
    case 'MATCHED': return 'bg-teal-100 text-teal-700 border border-teal-200'
    case 'PENDING_AP_REVIEW': return 'bg-yellow-100 text-yellow-700 border border-yellow-200'
    case 'AP_APPROVED': return 'bg-lime-100 text-lime-700 border border-lime-200'
    case 'PENDING_FM_REVIEW': return 'bg-orange-100 text-orange-700 border border-orange-200'
    case 'FM_APPROVED': return 'bg-green-100 text-green-700 border border-green-200'
    case 'REJECTED': return 'bg-red-100 text-red-700 border border-red-200'
    case 'PAYMENT_SCHEDULED': return 'bg-purple-100 text-purple-700 border border-purple-200'
    case 'RELEASED': return 'bg-emerald-100 text-emerald-700 border border-emerald-200'
    default: return 'bg-gray-100 text-gray-700 border border-gray-200'
  }
}

function formatStatus(status: string): string {
  return status.replace(/_/g, ' ')
}

// ─── WorkflowTimeline (inline) ───────────────────────────────

const WORKFLOW_STEPS = [
  'CLAIM_SUBMITTED',
  'DELIVERY_REPORT_UPLOADED',
  'GR_CONFIRMED',
  'THREE_WAY_MATCH',
  'AP_CLERK_APPROVED',
  'FM_APPROVED',
  'PAYMENT_SCHEDULED',
  'PAYMENT_RELEASED',
]

function WorkflowTimeline({ claimId }: { claimId: number }) {
  const [loading, setLoading] = useState(true)
  const [events, setEvents] = useState<WorkflowEvent[]>([])
  const [futureSteps, setFutureSteps] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    apiFetch(`/api/payable/claims/${claimId}/timeline`)
      .then(async (r) => {
        const text = await r.text()
        console.log('Timeline raw response for claim', claimId, 'status:', r.status, 'body:', text)
        if (!r.ok) throw new Error(`HTTP ${r.status}: ${text}`)
        const data = JSON.parse(text)
        setEvents(Array.isArray(data.events) ? data.events : [])
        setFutureSteps(Array.isArray(data.futureSteps) ? data.futureSteps : [])
        setLoading(false)
      })
      .catch((err) => {
        console.error('Timeline fetch error:', err)
        setError(err instanceof Error ? err.message : 'Failed to load timeline')
        setLoading(false)
      })
  }, [claimId])

  if (loading) return <p className="text-xs text-muted-foreground">Loading timeline…</p>
  if (error) return <p className="text-xs text-red-500">{error}</p>

  // Build a unified list: completed events, then waiting step, then future steps
  const allSteps: { type: 'completed' | 'waiting' | 'future'; label: string; performer?: string; date?: string }[] = []
  for (const ev of events) {
    allSteps.push({ type: 'completed', label: formatStatus(ev.eventType), performer: ev.performedBy || undefined, date: ev.createdAt ? new Date(ev.createdAt).toLocaleDateString() : undefined })
  }
  if (futureSteps.length > 0 && events.length > 0) {
    allSteps.push({ type: 'waiting', label: formatStatus(futureSteps[0]) })
  }
  const remainingFuture = futureSteps.slice(events.length > 0 ? 1 : 0)
  for (const step of remainingFuture) {
    allSteps.push({ type: 'future', label: formatStatus(step) })
  }

  return (
    <div className="relative mt-2 ml-1.5">
      {/* Vertical connecting line */}
      {allSteps.length > 1 && (
        <div
          className="absolute left-[5px] top-[6px] w-[2px]"
          style={{
            height: `calc(100% - 12px)`,
            background: events.length > 0
              ? `linear-gradient(to bottom, #22c55e 0%, #22c55e ${Math.round((events.length / allSteps.length) * 100)}%, #f59e0b ${Math.round((events.length / allSteps.length) * 100)}%, #d1d5db ${Math.round(((events.length + 1) / allSteps.length) * 100)}%, #d1d5db 100%)`
              : '#d1d5db',
          }}
        />
      )}

      <div className="space-y-2.5">
        {allSteps.map((step, i) => (
          <div key={i} className={`relative flex items-start gap-2.5 pl-5 ${step.type === 'future' ? 'opacity-40' : ''}`}>
            {/* Dot */}
            <div
              className={`absolute left-0 mt-0.5 h-3 w-3 rounded-full shrink-0 ${
                step.type === 'completed'
                  ? 'bg-green-500 ring-1 ring-green-300'
                  : step.type === 'waiting'
                  ? 'bg-amber-400 ring-1 ring-amber-300 animate-pulse'
                  : 'border-2 border-gray-300 bg-white'
              }`}
            />
            {/* Content */}
            <div className="min-w-0">
              <p className={`text-xs font-semibold ${
                step.type === 'completed' ? 'text-green-700' : step.type === 'waiting' ? 'text-amber-600' : 'text-gray-500'
              }`}>
                {step.label}
                {step.type === 'waiting' && <span className="text-[10px] font-normal text-muted-foreground"> (waiting)</span>}
              </p>
              {step.performer && <p className="text-[10px] text-muted-foreground">by {step.performer}</p>}
              {step.date && <p className="text-[10px] text-muted-foreground">{step.date}</p>}
            </div>
          </div>
        ))}
      </div>

      {events.length === 0 && futureSteps.length === 0 && (
        <p className="text-xs text-muted-foreground">No timeline events yet.</p>
      )}
    </div>
  )
}

// ─── SupplierEmulator ────────────────────────────────────────

export function SupplierEmulator() {
  const dispatch = useAppDispatch()
  const { selectedSupplierId, selectedPoId } = useAppSelector((s) => s.emulator)

  const [suppliers, setSuppliers] = useState<SupplierSummary[]>([])
  const [pos, setPos] = useState<POSummary[]>([])
  const [claims, setClaims] = useState<ClaimSummary[]>([])
  const [suppliersLoading, setSuppliersLoading] = useState(false)
  const [posLoading, setPosLoading] = useState(false)
  const [claimsLoading, setClaimsLoading] = useState(false)

  const [submitting, setSubmitting] = useState(false)
  const [uploadingId, setUploadingId] = useState<number | null>(null)
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null)

  const [timelineClaimId, setTimelineClaimId] = useState<number | null>(null)

  // Milestones for selected PO
  const [milestones, setMilestones] = useState<POMilestone[]>([])
  const [milestonesLoading, setMilestonesLoading] = useState(false)
  const [completingId, setCompletingId] = useState<number | null>(null)

  // Fetch suppliers on mount
  const fetchSuppliers = useCallback(() => {
    setSuppliersLoading(true)
    apiFetch('/api/payable?limit=200')
      .then((r) => r.json())
      .then((data) => {
        setSuppliers(Array.isArray(data) ? data : [])
        setSuppliersLoading(false)
      })
      .catch(() => setSuppliersLoading(false))
  }, [])

  useEffect(() => {
    fetchSuppliers()
  }, [fetchSuppliers])

  // Fetch POs when supplier changes
  useEffect(() => {
    if (!selectedSupplierId) {
      setPos([])
      return
    }
    setPosLoading(true)
    apiFetch(`/api/payable/${selectedSupplierId}`)
      .then((r) => r.json())
      .then((data) => {
        setPos(Array.isArray(data.purchase_orders) ? data.purchase_orders : [])
        setPosLoading(false)
      })
      .catch(() => setPosLoading(false))
  }, [selectedSupplierId])

  // Fetch recent claims for supplier
  const fetchClaims = useCallback(() => {
    if (!selectedSupplierId) {
      setClaims([])
      return
    }
    setClaimsLoading(true)
    apiFetch(`/api/payable/claims?supplierId=${selectedSupplierId}`)
      .then((r) => r.json())
      .then((data) => {
        setClaims(Array.isArray(data) ? data : [])
        setClaimsLoading(false)
      })
      .catch(() => setClaimsLoading(false))
  }, [selectedSupplierId])

  useEffect(() => {
    fetchClaims()
  }, [fetchClaims])

  // Fetch milestones when PO selected
  const fetchMilestones = useCallback(() => {
    if (!selectedPoId) {
      setMilestones([])
      return
    }
    setMilestonesLoading(true)
    apiFetch(`/api/payable/${selectedPoId}/milestones`)
      .then((r) => r.json())
      .then((data) => {
        setMilestones(Array.isArray(data) ? data : [])
        setMilestonesLoading(false)
      })
      .catch(() => setMilestonesLoading(false))
  }, [selectedPoId])

  useEffect(() => {
    fetchMilestones()
  }, [fetchMilestones])

  const selectedPo = pos.find((p) => p.po_id === selectedPoId) ?? null

  function showMessage(text: string, ok: boolean) {
    setMessage({ text, ok })
    setTimeout(() => setMessage(null), 4000)
  }

  async function handleSubmitClaim() {
    if (!selectedSupplierId || !selectedPoId || !selectedPo) return
    setSubmitting(true)
    try {
      const res = await apiFetch('/api/payable/claims', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplierId: selectedSupplierId,
          poId: selectedPoId,
          invoiceNumber: `INV-SUP-${Date.now()}`,
          amount: selectedPo.total_amount,
        }),
      })
      if (res.ok) {
        showMessage('Claim submitted successfully.', true)
        fetchClaims()
      } else {
        const err = await res.json()
        showMessage(err.error ?? 'Submission failed.', false)
      }
    } catch {
      showMessage('Network error.', false)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleMarkComplete(milestoneId: number) {
    if (!selectedPoId) return
    setCompletingId(milestoneId)
    try {
      const res = await apiFetch(`/api/payable/${selectedPoId}/milestones/${milestoneId}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      if (res.ok) {
        showMessage('Milestone marked as complete.', true)
        fetchMilestones()
      } else {
        const err = await res.json()
        showMessage(err.error ?? 'Failed to mark complete.', false)
      }
    } catch {
      showMessage('Network error.', false)
    } finally {
      setCompletingId(null)
    }
  }

  async function handleUploadDeliveryReport(claimId: number) {
    setUploadingId(claimId)
    // Generate a fake base64 "document" for demo purposes
    const fakeDoc = btoa(`DELIVERY_REPORT_${claimId}_${Date.now()}`)
    const documentUrl = `data:application/pdf;base64,${fakeDoc}`
    try {
      const res = await apiFetch(`/api/payable/claims/${claimId}/upload`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentUrl }),
      })
      if (res.ok) {
        showMessage('Delivery report uploaded.', true)
        fetchClaims()
      } else {
        const err = await res.json()
        showMessage(err.error ?? 'Upload failed.', false)
      }
    } catch {
      showMessage('Network error.', false)
    } finally {
      setUploadingId(null)
    }
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Supplier + PO selectors */}
      <div className="px-3 py-2.5 border-b border-border shrink-0 space-y-2">
        <select
          value={selectedSupplierId ?? ''}
          onChange={(e) => {
            const val = e.target.value
            dispatch(setSelectedSupplier(val ? Number(val) : null))
          }}
          className="w-full rounded border border-input bg-background px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#C5A930]"
        >
          <option value="">
            {suppliersLoading ? 'Loading suppliers…' : '— Select a supplier —'}
          </option>
          {suppliers.map((s) => (
            <option key={s.supplier_id} value={s.supplier_id}>
              {s.name}
            </option>
          ))}
        </select>

        {selectedSupplierId && (
          <select
            value={selectedPoId ?? ''}
            onChange={(e) => {
              const val = e.target.value
              dispatch(setSelectedPo(val ? Number(val) : null))
            }}
            className="w-full rounded border border-input bg-background px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#C5A930]"
          >
            <option value="">
              {posLoading ? 'Loading POs…' : '— Select a purchase order —'}
            </option>
            {pos.map((p) => (
              <option key={p.po_id} value={p.po_id}>
                {p.po_number} — ₱{Number(p.total_amount).toLocaleString()}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Action buttons */}
      {selectedSupplierId && selectedPoId && (
        <div className="px-3 py-2.5 border-b border-border shrink-0 space-y-2">
          <button
            onClick={handleSubmitClaim}
            disabled={submitting}
            className="w-full rounded py-1.5 text-xs font-semibold text-white transition-opacity disabled:opacity-50"
            style={{ backgroundColor: '#C5A930' }}
          >
            {submitting ? 'Submitting…' : 'Submit Claim / Invoice'}
          </button>
        </div>
      )}

      {/* Milestones for selected PO */}
      {selectedPoId && (
        <div className="px-3 py-2.5 border-b border-border shrink-0">
          <p className="text-xs font-semibold text-foreground mb-1.5">PO Milestones</p>
          {milestonesLoading ? (
            <p className="text-xs text-muted-foreground">Loading milestones…</p>
          ) : milestones.length === 0 ? (
            <p className="text-xs text-muted-foreground">No milestones assigned to this PO.</p>
          ) : (
            <div className="space-y-1.5">
              {/* Mini progress bar */}
              <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-gray-200">
                {milestones.map((m) => {
                  const color =
                    m.status === 'PAID'
                      ? 'bg-green-500'
                      : m.status === 'COMPLETED'
                      ? 'bg-amber-400'
                      : 'bg-gray-300'
                  return (
                    <div
                      key={m.milestoneId}
                      className={`${color} h-full`}
                      style={{ width: `${m.percentage}%` }}
                      title={`${m.label}: ${m.status}`}
                    />
                  )
                })}
              </div>
              {milestones.map((m, idx) => {
                const isNextPending = m.status === 'PENDING' && milestones.slice(0, idx).every((prev) => prev.status !== 'PENDING')
                const statusColor =
                  m.status === 'PAID'
                    ? 'text-green-600'
                    : m.status === 'COMPLETED'
                    ? 'text-amber-600'
                    : 'text-gray-500'
                const dot =
                  m.status === 'PAID'
                    ? 'bg-green-500'
                    : m.status === 'COMPLETED'
                    ? 'bg-amber-400'
                    : 'bg-gray-300'
                return (
                  <div key={m.milestoneId} className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <div className={`h-2 w-2 rounded-full shrink-0 ${dot}`} />
                      <span className="text-[10px] text-foreground truncate">{m.label}</span>
                      <span className={`text-[10px] font-medium shrink-0 ${statusColor}`}>
                        {m.status}
                      </span>
                    </div>
                    {isNextPending && (
                      <button
                        onClick={() => handleMarkComplete(m.milestoneId)}
                        disabled={completingId === m.milestoneId}
                        className="shrink-0 rounded border border-[#C5A930] text-[#C5A930] px-1.5 py-0.5 text-[10px] font-medium hover:bg-[#C5A930]/10 disabled:opacity-50 transition-colors"
                      >
                        {completingId === m.milestoneId ? 'Saving…' : 'Mark Complete'}
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Message banner */}
      {message && (
        <div
          className={`mx-3 mt-2 rounded px-3 py-1.5 text-xs font-medium ${
            message.ok
              ? 'bg-green-50 text-green-700 border border-green-200'
              : 'bg-red-50 text-red-700 border border-red-200'
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Recent Submissions */}
      <div className="flex-1 px-3 py-2.5 space-y-2 overflow-y-auto">
        {!selectedSupplierId ? (
          <p className="text-xs text-muted-foreground text-center mt-8 px-4">
            Select a supplier above to emulate their portal experience.
          </p>
        ) : claimsLoading ? (
          <p className="text-xs text-muted-foreground">Loading submissions…</p>
        ) : claims.length === 0 ? (
          <p className="text-xs text-muted-foreground">No submissions yet.</p>
        ) : (
          <>
            <p className="text-xs font-semibold text-foreground">Recent Submissions</p>
            {claims.map((claim) => (
              <div
                key={claim.supplierInvoiceId}
                className="rounded border border-border bg-gray-50 px-2.5 py-2 space-y-1.5"
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="text-xs font-medium truncate">{claim.invoiceNumber}</span>
                  <span
                    className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] font-medium ${workflowBadgeClass(claim.workflowStatus)}`}
                  >
                    {formatStatus(claim.workflowStatus)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-1 text-[10px] text-muted-foreground">
                  <span>PO: {claim.poNumber}</span>
                  <span>₱{claim.amount.toLocaleString()}</span>
                </div>

                {/* Per-claim action buttons */}
                <div className="flex gap-1.5 pt-0.5">
                  <button
                    onClick={() => handleUploadDeliveryReport(claim.supplierInvoiceId)}
                    disabled={uploadingId === claim.supplierInvoiceId}
                    className="flex-1 rounded border border-[#C5A930] text-[#C5A930] py-1 text-[10px] font-medium transition-opacity disabled:opacity-50 hover:bg-[#C5A930]/10"
                  >
                    {uploadingId === claim.supplierInvoiceId ? 'Uploading…' : 'Upload Delivery Report'}
                  </button>
                  <button
                    onClick={() =>
                      setTimelineClaimId(
                        timelineClaimId === claim.supplierInvoiceId ? null : claim.supplierInvoiceId
                      )
                    }
                    className="flex-1 rounded border border-gray-300 text-gray-600 py-1 text-[10px] font-medium hover:bg-gray-100 transition-colors"
                  >
                    {timelineClaimId === claim.supplierInvoiceId ? 'Hide Timeline' : 'Check Payment Status'}
                  </button>
                </div>

                {/* Inline timeline */}
                {timelineClaimId === claim.supplierInvoiceId && (
                  <div className="border-t border-border pt-2">
                    <WorkflowTimeline claimId={claim.supplierInvoiceId} />
                  </div>
                )}
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  )
}
