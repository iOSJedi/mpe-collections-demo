'use client'

import { useEffect, useState, useCallback } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import type { ClaimSummary, WorkflowStatus } from '@/types'
import { apiFetch } from '@/lib/api'
import { formatCurrency } from '@/lib/utils'
import WorkflowTimeline from '@/components/payable/WorkflowTimeline'
import { DocumentViewer } from '@/components/documents/DocumentViewer'

// ─── Types ────────────────────────────────────────────────────────────────────

type Role = 'AP_CLERK' | 'FINANCE_MANAGER'
type TabKey = 'pending' | 'all' | 'released'

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_BADGE: Record<WorkflowStatus, string> = {
  SUBMITTED: 'bg-blue-100 text-blue-800',
  GR_CONFIRMED: 'bg-amber-100 text-amber-800',
  MATCHED: 'bg-amber-100 text-amber-800',
  PENDING_AP_REVIEW: 'bg-orange-100 text-orange-800',
  AP_APPROVED: 'bg-orange-100 text-orange-800',
  PENDING_FM_REVIEW: 'bg-purple-100 text-purple-800',
  FM_APPROVED: 'bg-purple-100 text-purple-800',
  REJECTED: 'bg-red-100 text-red-800',
  PAYMENT_SCHEDULED: 'bg-teal-100 text-teal-800',
  RELEASED: 'bg-green-100 text-green-800',
}

const STATUS_LABEL: Record<WorkflowStatus, string> = {
  SUBMITTED: 'Submitted',
  GR_CONFIRMED: 'GR Confirmed',
  MATCHED: 'Matched',
  PENDING_AP_REVIEW: 'Pending AP Review',
  AP_APPROVED: 'AP Approved',
  PENDING_FM_REVIEW: 'Pending FM Review',
  FM_APPROVED: 'FM Approved',
  REJECTED: 'Rejected',
  PAYMENT_SCHEDULED: 'Payment Scheduled',
  RELEASED: 'Released',
}

const TABS: { key: TabKey; label: string; statusFilter: string | null }[] = [
  { key: 'pending', label: 'Pending My Review', statusFilter: null },
  { key: 'all', label: 'All Claims', statusFilter: null },
  { key: 'released', label: 'Released', statusFilter: 'RELEASED' },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function Badge({ label, className }: { label: string; className: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${className}`}>
      {label}
    </span>
  )
}

function formatDate(dateStr: string) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' })
}

function pendingForRole(claim: ClaimSummary, role: Role): boolean {
  if (role === 'AP_CLERK') {
    return ['SUBMITTED', 'GR_CONFIRMED', 'MATCHED', 'PENDING_AP_REVIEW'].includes(claim.workflowStatus)
  }
  // Finance Manager sees AP_APPROVED / PENDING_FM_REVIEW
  return ['AP_APPROVED', 'PENDING_FM_REVIEW'].includes(claim.workflowStatus)
}

// ─── DocumentDialog ───────────────────────────────────────────────────────────

interface DocumentDialogProps {
  claim: ClaimSummary | null
  onClose: () => void
}

function DocumentDialog({ claim, onClose }: DocumentDialogProps) {
  if (!claim) return null

  const viewerDoc = {
    documentId: 0,
    fileUrl: claim.claimDocumentUrl || '',
    fileName: 'Delivery Report',
    fileType: 'image/jpeg',
    ocrResult: null,
    ocrStatus: 'N/A',
    validationResult: null,
  }

  return (
    <Dialog.Root open={!!claim} onOpenChange={(v) => { if (!v) onClose() }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 z-40" />
        <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-xl shadow-2xl focus:outline-none">
          <div className="flex items-center justify-between px-5 py-3 bg-[#1c1c2e] border-b border-[#2a2a3e]">
            <Dialog.Title className="text-sm font-semibold text-[#e0e0f0]">
              Claim Document — {claim.invoiceNumber}
            </Dialog.Title>
            <Dialog.Close asChild>
              <button className="text-[#6666aa] hover:text-[#aaaacc] text-xl leading-none">&times;</button>
            </Dialog.Close>
          </div>
          <DocumentViewer
            document={viewerDoc}
            customerName={claim.supplierName}
            invoiceNumber={claim.invoiceNumber}
            expectedAmount={claim.amount}
          />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

// ─── ClaimCard ────────────────────────────────────────────────────────────────

interface ClaimCardProps {
  claim: ClaimSummary
  role: Role
  onApprove: (id: number) => void
  onReject: (id: number) => void
  onViewTimeline: (claim: ClaimSummary) => void
  onViewDocument: (claim: ClaimSummary) => void
}

function ClaimCard({ claim, role, onApprove, onReject, onViewTimeline, onViewDocument }: ClaimCardProps) {
  return (
    <div className="border border-slate-200 rounded-xl p-4 bg-white space-y-3 hover:shadow-sm transition-shadow">
      {/* Header row */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <p className="font-semibold text-slate-900 text-sm">{claim.invoiceNumber}</p>
          <p className="text-slate-500 text-xs mt-0.5">{claim.supplierName}</p>
        </div>
        <Badge
          label={STATUS_LABEL[claim.workflowStatus] ?? claim.workflowStatus}
          className={STATUS_BADGE[claim.workflowStatus] ?? 'bg-slate-100 text-slate-700'}
        />
      </div>

      {/* Meta row */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-slate-600">
        <div>
          <span className="text-slate-400">Amount</span>
          <p className="font-medium text-slate-800 text-sm">{formatCurrency(claim.amount)}</p>
        </div>
        <div>
          <span className="text-slate-400">PO Number</span>
          <p className="font-medium text-slate-800">{claim.poNumber || '—'}</p>
        </div>
        <div>
          <span className="text-slate-400">GR Verification</span>
          <p>
            {claim.grVerified ? (
              <span className="text-green-600 font-medium">Verified</span>
            ) : (
              <span className="text-slate-400">Pending</span>
            )}
          </p>
        </div>
        <div>
          <span className="text-slate-400">3-Way Match</span>
          <p className="font-medium text-slate-800">{claim.threeWayMatch ?? '—'}</p>
        </div>
        <div>
          <span className="text-slate-400">Submitted</span>
          <p className="font-medium text-slate-800">{formatDate(claim.submittedDate)}</p>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex flex-wrap gap-2 pt-1">
        {role === 'AP_CLERK' ? (
          <>
            <button
              onClick={() => onApprove(claim.supplierInvoiceId)}
              className="px-3 py-1.5 text-xs font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              Approve
            </button>
            <button
              onClick={() => onReject(claim.supplierInvoiceId)}
              className="px-3 py-1.5 text-xs font-medium border border-red-400 text-red-600 rounded-lg hover:bg-red-50 transition-colors"
            >
              Reject
            </button>
            <button
              onClick={() => onViewDocument(claim)}
              disabled={!claim.claimDocumentUrl}
              className="px-3 py-1.5 text-xs font-medium border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              View Documents
            </button>
            <button
              onClick={() => onViewTimeline(claim)}
              className="px-3 py-1.5 text-xs font-medium border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 transition-colors"
            >
              View Timeline
            </button>
          </>
        ) : (
          <>
            <button
              onClick={() => onApprove(claim.supplierInvoiceId)}
              className="px-3 py-1.5 text-xs font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              Authorize Payment
            </button>
            <button
              onClick={() => onReject(claim.supplierInvoiceId)}
              className="px-3 py-1.5 text-xs font-medium border border-red-400 text-red-600 rounded-lg hover:bg-red-50 transition-colors"
            >
              Return to AP
            </button>
            <button
              onClick={() => onViewTimeline(claim)}
              className="px-3 py-1.5 text-xs font-medium border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 transition-colors"
            >
              View Timeline
            </button>
          </>
        )}
      </div>
    </div>
  )
}

// ─── RejectDialog ─────────────────────────────────────────────────────────────

interface RejectDialogProps {
  open: boolean
  onClose: () => void
  onConfirm: (notes: string) => void
}

function RejectDialog({ open, onClose, onConfirm }: RejectDialogProps) {
  const [notes, setNotes] = useState('')

  const handleConfirm = () => {
    onConfirm(notes)
    setNotes('')
  }

  const handleClose = () => {
    setNotes('')
    onClose()
  }

  return (
    <Dialog.Root open={open} onOpenChange={(v) => { if (!v) handleClose() }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40 z-40" />
        <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 bg-white rounded-xl shadow-xl p-6 w-full max-w-md space-y-4">
          <Dialog.Title className="text-base font-semibold text-slate-900">Reject / Return Claim</Dialog.Title>
          <Dialog.Description className="text-sm text-slate-500">
            Please provide notes explaining the reason for rejection.
          </Dialog.Description>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Enter rejection notes…"
            rows={4}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
          <div className="flex justify-end gap-2">
            <button
              onClick={handleClose}
              className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              className="px-4 py-2 text-sm font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              Confirm Reject
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

// ─── TimelineDialog ───────────────────────────────────────────────────────────

interface TimelineDialogProps {
  claim: ClaimSummary | null
  onClose: () => void
}

function TimelineDialog({ claim, onClose }: TimelineDialogProps) {
  return (
    <Dialog.Root open={!!claim} onOpenChange={(v) => { if (!v) onClose() }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40 z-40" />
        <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 bg-white rounded-xl shadow-xl p-6 w-full max-w-lg max-h-[80vh] overflow-y-auto space-y-4">
          <div className="flex items-center justify-between">
            <Dialog.Title className="text-base font-semibold text-slate-900">
              Workflow Timeline — {claim?.invoiceNumber}
            </Dialog.Title>
            <Dialog.Close asChild>
              <button className="text-slate-400 hover:text-slate-600 text-lg leading-none">&times;</button>
            </Dialog.Close>
          </div>
          {claim && (
            <WorkflowTimeline supplierInvoiceId={claim.supplierInvoiceId} />
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

// ─── ApprovalQueue (main export) ─────────────────────────────────────────────

export function ApprovalQueue() {
  const [activeTab, setActiveTab] = useState<TabKey>('pending')
  const [role, setRole] = useState<Role>('AP_CLERK')
  const [claims, setClaims] = useState<ClaimSummary[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState<number | null>(null)

  // Reject dialog state
  const [rejectTargetId, setRejectTargetId] = useState<number | null>(null)

  // Timeline dialog state
  const [timelineClaim, setTimelineClaim] = useState<ClaimSummary | null>(null)

  // Document dialog state
  const [documentClaim, setDocumentClaim] = useState<ClaimSummary | null>(null)

  const fetchClaims = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      const tab = TABS.find((t) => t.key === activeTab)
      if (tab?.statusFilter) params.set('status', tab.statusFilter)

      const res = await apiFetch(`/api/payable/claims?${params.toString()}`)
      if (!res.ok) throw new Error('Failed to load claims')
      const data: ClaimSummary[] = await res.json()
      setClaims(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [activeTab])

  useEffect(() => {
    fetchClaims()
  }, [fetchClaims])

  // Filter "Pending My Review" client-side based on role
  const displayedClaims = activeTab === 'pending'
    ? claims.filter((c) => pendingForRole(c, role))
    : claims

  const handleApprove = async (id: number) => {
    setActionLoading(id)
    try {
      const res = await apiFetch(`/api/payable/claims/${id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role }),
      })
      if (!res.ok) throw new Error('Approval failed')
      await fetchClaims()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Approval failed')
    } finally {
      setActionLoading(null)
    }
  }

  const handleRejectConfirm = async (notes: string) => {
    if (rejectTargetId === null) return
    setRejectTargetId(null)
    setActionLoading(rejectTargetId)
    try {
      const res = await apiFetch(`/api/payable/claims/${rejectTargetId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role, notes }),
      })
      if (!res.ok) throw new Error('Rejection failed')
      await fetchClaims()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Rejection failed')
    } finally {
      setActionLoading(null)
    }
  }

  return (
    <div className="space-y-4">
      {/* Role selector */}
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium text-slate-700">Viewing as:</label>
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as Role)}
          className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="AP_CLERK">AP Clerk</option>
          <option value="FINANCE_MANAGER">Finance Manager</option>
        </select>
        <span className="text-xs text-slate-400 italic">Role simulation — no actual RBAC</span>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 gap-0">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeTab === tab.key
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading && (
        <div className="text-center py-12 text-slate-400 text-sm">Loading claims…</div>
      )}
      {!loading && error && (
        <div className="text-center py-12 text-red-500 text-sm">{error}</div>
      )}
      {!loading && !error && displayedClaims.length === 0 && (
        <div className="text-center py-12 text-slate-400 text-sm">No claims found.</div>
      )}
      {!loading && !error && displayedClaims.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {displayedClaims.map((claim) => (
            <div key={claim.supplierInvoiceId} className={actionLoading === claim.supplierInvoiceId ? 'opacity-50 pointer-events-none' : ''}>
              <ClaimCard
                claim={claim}
                role={role}
                onApprove={handleApprove}
                onReject={(id) => setRejectTargetId(id)}
                onViewTimeline={setTimelineClaim}
                onViewDocument={setDocumentClaim}
              />
            </div>
          ))}
        </div>
      )}

      {/* Reject dialog */}
      <RejectDialog
        open={rejectTargetId !== null}
        onClose={() => setRejectTargetId(null)}
        onConfirm={handleRejectConfirm}
      />

      {/* Timeline dialog */}
      <TimelineDialog
        claim={timelineClaim}
        onClose={() => setTimelineClaim(null)}
      />

      {/* Document dialog */}
      <DocumentDialog
        claim={documentClaim}
        onClose={() => setDocumentClaim(null)}
      />
    </div>
  )
}
