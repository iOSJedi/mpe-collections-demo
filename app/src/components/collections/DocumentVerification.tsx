'use client'

import { useEffect, useState, useCallback } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { apiFetch } from '@/lib/api'
import { DocumentRecord } from '@/types'
import { DocumentViewer } from '@/components/documents/DocumentViewer'

const OCR_STATUS_BADGE: Record<string, string> = {
  PENDING: 'bg-amber-100 text-amber-800',
  COMPLETED: 'bg-green-100 text-green-800',
  FAILED: 'bg-red-100 text-red-800',
}

function Badge({ label, className }: { label: string; className: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${className}`}>
      {label}
    </span>
  )
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// ─── DocumentViewerDialog ────────────────────────────────────────────────────

function RunOcrButton({ documentId, onComplete }: { documentId: number; onComplete: () => void }) {
  const [running, setRunning] = useState(false)

  async function handleRunOcr(e: React.MouseEvent) {
    e.stopPropagation()
    setRunning(true)
    try {
      const res = await apiFetch('/api/ocr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentId }),
      })
      if (!res.ok) {
        const err = await res.json()
        alert(err.error ?? 'OCR failed')
      } else {
        onComplete()
      }
    } catch {
      alert('OCR request failed')
    } finally {
      setRunning(false)
    }
  }

  return (
    <button
      onClick={handleRunOcr}
      disabled={running}
      className="px-2 py-0.5 text-xs font-medium rounded border border-amber-400 text-amber-600 hover:bg-amber-50 transition-colors whitespace-nowrap disabled:opacity-50"
    >
      {running ? 'Running...' : 'Run OCR'}
    </button>
  )
}

function DocumentViewerDialog({ doc, onRefresh }: { doc: DocumentRecord; onRefresh: () => void }) {
  const [open, setOpen] = useState(false)
  const [currentDoc, setCurrentDoc] = useState(doc)
  const [ocrRunning, setOcrRunning] = useState(false)

  // Keep in sync with parent
  useState(() => { setCurrentDoc(doc) })

  const viewerDoc = {
    documentId: currentDoc.document_id,
    fileUrl: currentDoc.file_url,
    fileName: currentDoc.file_name,
    fileType: currentDoc.file_type,
    ocrResult: currentDoc.ocr_result,
    ocrStatus: currentDoc.ocr_status,
    validationResult: currentDoc.validation_result,
  }

  async function handleRunOcrInDialog() {
    setOcrRunning(true)
    try {
      const res = await apiFetch('/api/ocr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentId: currentDoc.document_id }),
      })
      if (res.ok) {
        const updated = await res.json()
        // Parse JSONB that may be double-encoded
        let ocr = updated.ocr_result ?? updated.ocrResult
        if (typeof ocr === 'string') try { ocr = JSON.parse(ocr) } catch {}
        let val = updated.validation_result ?? updated.validationResult
        if (typeof val === 'string') try { val = JSON.parse(val) } catch {}
        setCurrentDoc({ ...currentDoc, ocr_result: ocr, validation_result: val, ocr_status: 'COMPLETED' })
        onRefresh()
      }
    } catch {} finally {
      setOcrRunning(false)
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button
          onClick={(e) => e.stopPropagation()}
          className="px-2 py-0.5 text-xs font-medium rounded border border-blue-300 text-blue-600 hover:bg-blue-50 transition-colors whitespace-nowrap"
        >
          View
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 z-40" />
        <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-xl shadow-2xl focus:outline-none">
          <div className="flex items-center justify-between px-5 py-3 bg-[#1c1c2e] border-b border-[#2a2a3e]">
            <Dialog.Title className="text-sm font-semibold text-[#e0e0f0]">
              Document Review — {currentDoc.file_name}
            </Dialog.Title>
            <div className="flex items-center gap-2">
              {currentDoc.ocr_status === 'PENDING' && (
                <button
                  onClick={handleRunOcrInDialog}
                  disabled={ocrRunning}
                  className="px-3 py-1 text-xs font-medium rounded bg-amber-500 text-white hover:bg-amber-600 transition-colors disabled:opacity-50"
                >
                  {ocrRunning ? 'Processing...' : 'Run AI Analysis'}
                </button>
              )}
              <Dialog.Close asChild>
                <button className="text-[#6666aa] hover:text-[#aaaacc] text-xl leading-none">&times;</button>
              </Dialog.Close>
            </div>
          </div>
          <DocumentViewer
            document={viewerDoc}
            customerName={currentDoc.customer_name}
            invoiceNumber={currentDoc.invoice_number ?? undefined}
          />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

export function DocumentVerification() {
  const [docs, setDocs] = useState<DocumentRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchDocs = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await apiFetch('/api/documents')
      if (!res.ok) throw new Error('Failed to load documents')
      const data: DocumentRecord[] = await res.json()
      setDocs(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchDocs()
  }, [fetchDocs])

  return (
    <div className="space-y-4">
      <div className="border border-slate-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Customer</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600 whitespace-nowrap">Invoice #</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">File Name</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600 whitespace-nowrap">OCR Status</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Validation</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600 whitespace-nowrap">Uploaded At</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Review</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-100">
              {loading && (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-slate-400">Loading documents...</td>
                </tr>
              )}
              {!loading && error && (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-red-500">{error}</td>
                </tr>
              )}
              {!loading && !error && docs.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-slate-400">No documents found.</td>
                </tr>
              )}
              {!loading && !error && docs.map((doc) => {
                const validPassed = doc.validation_result?.is_valid

                return (
                  <tr
                    key={doc.document_id}
                    className="hover:bg-slate-50 transition-colors"
                  >
                    <td className="px-4 py-3 font-medium text-slate-800 whitespace-nowrap">
                      {doc.customer_name}
                    </td>
                    <td className="px-4 py-3 text-slate-600 font-mono text-xs whitespace-nowrap">
                      {doc.invoice_number ?? <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-slate-700 max-w-[200px] truncate" title={doc.file_name}>
                      {doc.file_name}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <Badge
                        label={doc.ocr_status}
                        className={OCR_STATUS_BADGE[doc.ocr_status] ?? 'bg-slate-100 text-slate-700'}
                      />
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {doc.validation_result == null ? (
                        <span className="text-slate-300 text-xs">—</span>
                      ) : validPassed ? (
                        <span className="text-green-600 font-semibold flex items-center gap-1">
                          <span>✓</span> PASS
                        </span>
                      ) : (
                        <span className="text-red-600 font-semibold flex items-center gap-1">
                          <span>✗</span> FAIL
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-500 whitespace-nowrap text-xs">
                      {formatDate(doc.uploaded_at)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <DocumentViewerDialog doc={doc} onRefresh={fetchDocs} />
                        {doc.ocr_status === 'PENDING' && (
                          <RunOcrButton documentId={doc.document_id} onComplete={fetchDocs} />
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {!loading && !error && docs.length > 0 && (
          <div className="border-t border-slate-100 bg-slate-50 px-4 py-2 text-xs text-slate-500">
            {docs.length} document{docs.length !== 1 ? 's' : ''} · Click View to inspect document with AI analysis
          </div>
        )}
      </div>
    </div>
  )
}
