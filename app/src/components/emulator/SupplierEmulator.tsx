'use client'

import { useEffect, useState, useCallback } from 'react'
import { useAppDispatch, useAppSelector } from '@/store'
import { setSelectedSupplier, setSelectedPo } from '@/store/slices/emulatorSlice'
import { apiFetch } from '@/lib/api'
import type { SupplierSummary, POSummary, ClaimSummary, WorkflowEvent, WorkflowStatus } from '@/types'

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

  return (
    <div className="space-y-1.5 mt-2">
      {events.map((ev) => (
        <div key={ev.eventId} className="flex items-start gap-2">
          <div className="mt-0.5 h-3 w-3 rounded-full bg-green-500 shrink-0 ring-1 ring-green-300" />
          <div>
            <p className="text-xs font-semibold text-green-700">{formatStatus(ev.eventType)}</p>
            {ev.performedBy && (
              <p className="text-[10px] text-muted-foreground">by {ev.performedBy}</p>
            )}
            {ev.createdAt && (
              <p className="text-[10px] text-muted-foreground">
                {new Date(ev.createdAt).toLocaleDateString()}
              </p>
            )}
          </div>
        </div>
      ))}
      {futureSteps.length > 0 && events.length > 0 && (
        <div className="flex items-start gap-2">
          <div className="mt-0.5 h-3 w-3 rounded-full bg-amber-400 shrink-0 ring-1 ring-amber-300 animate-pulse" />
          <p className="text-xs font-medium text-amber-600">{formatStatus(futureSteps[0])} <span className="text-[10px] font-normal text-muted-foreground">(waiting)</span></p>
        </div>
      )}
      {futureSteps.slice(events.length > 0 ? 1 : 0).map((step) => (
        <div key={step} className="flex items-start gap-2 opacity-40">
          <div className="mt-0.5 h-3 w-3 rounded-full border border-gray-400 shrink-0" />
          <p className="text-xs">{formatStatus(step)}</p>
        </div>
      ))}
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
