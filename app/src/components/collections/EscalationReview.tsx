'use client'

import { useState } from 'react'
import { EscalationRecord } from '@/types'

interface EscalationReviewProps {
  escalation: EscalationRecord
  onClose: () => void
  onUpdated: (updated: EscalationRecord) => void
}

async function patchEscalation(
  id: number,
  body: { status: 'RESOLVED' | 'DISMISSED'; resolution_notes: string }
): Promise<EscalationRecord> {
  const res = await fetch(`/api/escalations/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error ?? 'Failed to update escalation')
  }
  return res.json()
}

function AiAnalysisPanel({ aiAnalysis }: { aiAnalysis: Record<string, unknown> | null }) {
  if (!aiAnalysis) return <p className="text-slate-400 italic text-sm">No AI analysis available.</p>

  const summary = (aiAnalysis.summary ?? aiAnalysis.analysis ?? aiAnalysis.notes) as string | undefined
  const discrepancies = aiAnalysis.discrepancies as { field: string; expected: unknown; actual: unknown }[] | undefined
  const confidence = aiAnalysis.confidence_score as number | undefined

  return (
    <div className="space-y-3">
      {summary && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-900">
          {summary}
        </div>
      )}
      {confidence != null && (
        <div className="text-xs text-slate-500">
          AI Confidence: <span className="font-semibold text-slate-700">{(confidence * 100).toFixed(0)}%</span>
        </div>
      )}
      {discrepancies && discrepancies.length > 0 && (
        <div>
          <h5 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Discrepancies</h5>
          <ul className="space-y-1">
            {discrepancies.map((d, i) => (
              <li key={i} className="text-xs flex gap-2 text-slate-700">
                <span className="font-medium w-32 shrink-0">{d.field}</span>
                <span className="text-slate-400">Expected:</span>
                <span className="font-mono text-green-700">{String(d.expected)}</span>
                <span className="text-slate-400">Got:</span>
                <span className="font-mono text-red-600">{String(d.actual)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {!summary && !discrepancies && (
        <pre className="text-xs text-slate-600 bg-slate-50 rounded p-3 overflow-auto max-h-48">
          {JSON.stringify(aiAnalysis, null, 2)}
        </pre>
      )}
    </div>
  )
}

export function EscalationReview({ escalation, onClose, onUpdated }: EscalationReviewProps) {
  const [notes, setNotes] = useState(escalation.resolution_notes ?? '')
  const [loading, setLoading] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  const handleAction = async (status: 'RESOLVED' | 'DISMISSED') => {
    setLoading(true)
    setActionError(null)
    try {
      const updated = await patchEscalation(escalation.escalation_id, {
        status,
        resolution_notes: notes,
      })
      onUpdated({ ...escalation, ...updated, status, resolution_notes: notes })
      onClose()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  const handleRequestReupload = async () => {
    setLoading(true)
    setActionError(null)
    try {
      const updated = await patchEscalation(escalation.escalation_id, {
        status: 'DISMISSED',
        resolution_notes: notes || 'Reupload requested by reviewer.',
      })
      onUpdated({ ...escalation, ...updated, status: 'DISMISSED' })
      onClose()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      {/* Panel */}
      <div className="bg-white w-full sm:max-w-2xl sm:rounded-xl shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-4 border-b border-slate-200">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Escalation Review</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {escalation.customer_name} · {escalation.file_name ?? 'No document'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 text-xl leading-none ml-4"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-6 py-4 space-y-6">
          {/* Type + Description */}
          <div>
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-800 mb-2">
              {escalation.type}
            </span>
            <p className="text-sm text-slate-700">{escalation.description}</p>
          </div>

          {/* AI Analysis */}
          <div>
            <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">AI Analysis</h4>
            <AiAnalysisPanel aiAnalysis={escalation.ai_analysis} />
          </div>

          {/* Data Comparison */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">OCR Extracted</h4>
              <div className="bg-slate-50 rounded-lg p-3 text-xs space-y-1 text-slate-700">
                {escalation.ai_analysis?.ocr_data
                  ? Object.entries(escalation.ai_analysis.ocr_data as Record<string, unknown>).map(([k, v]) => (
                    <div key={k} className="flex gap-2">
                      <span className="text-slate-400 w-28 shrink-0 capitalize">{k.replace(/_/g, ' ')}</span>
                      <span className="font-mono">{String(v ?? '—')}</span>
                    </div>
                  ))
                  : <span className="text-slate-400 italic">No extracted data</span>
                }
              </div>
            </div>
            <div>
              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">System Expected</h4>
              <div className="bg-slate-50 rounded-lg p-3 text-xs space-y-1 text-slate-700">
                {escalation.invoice_number && (
                  <div className="flex gap-2">
                    <span className="text-slate-400 w-28 shrink-0">Invoice #</span>
                    <span className="font-mono">{escalation.invoice_number}</span>
                  </div>
                )}
                <div className="flex gap-2">
                  <span className="text-slate-400 w-28 shrink-0">Customer</span>
                  <span className="font-mono">{escalation.customer_name}</span>
                </div>
                {escalation.ai_analysis?.expected_data
                  ? Object.entries(escalation.ai_analysis.expected_data as Record<string, unknown>).map(([k, v]) => (
                    <div key={k} className="flex gap-2">
                      <span className="text-slate-400 w-28 shrink-0 capitalize">{k.replace(/_/g, ' ')}</span>
                      <span className="font-mono">{String(v ?? '—')}</span>
                    </div>
                  ))
                  : null
                }
              </div>
            </div>
          </div>

          {/* Resolution Notes */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
              Resolution Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Add resolution notes..."
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          {actionError && (
            <p className="text-sm text-red-500">{actionError}</p>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex flex-wrap gap-3 px-6 py-4 border-t border-slate-200 bg-slate-50">
          <button
            disabled={loading}
            onClick={() => handleAction('RESOLVED')}
            className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
          >
            Accept Payment
          </button>
          <button
            disabled={loading}
            onClick={() => handleAction('DISMISSED')}
            className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
          >
            Reject
          </button>
          <button
            disabled={loading}
            onClick={handleRequestReupload}
            className="px-4 py-2 text-sm bg-amber-500 text-white rounded-lg hover:bg-amber-600 disabled:opacity-50 transition-colors"
          >
            Request Reupload
          </button>
          <button
            disabled={loading}
            onClick={onClose}
            className="ml-auto px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-100 disabled:opacity-50 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
