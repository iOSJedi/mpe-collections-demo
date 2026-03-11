'use client'

import { useEffect, useState, useCallback } from 'react'
import { DocumentRecord, OcrResult, ValidationCheck } from '@/types'

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

function OcrPanel({ ocr, validation }: { ocr: OcrResult | null; validation: DocumentRecord['validation_result'] }) {
  if (!ocr && !validation) {
    return <p className="text-slate-400 text-sm italic">No OCR data available.</p>
  }

  const checks: ValidationCheck[] = validation?.checks ?? []

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 bg-slate-50 border-t border-slate-200">
      {/* Extracted Fields */}
      <div>
        <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Extracted Fields</h4>
        {ocr ? (
          <dl className="space-y-2">
            {([
              ['Payment Amount', ocr.payment_amount != null ? `₱${Number(ocr.payment_amount).toLocaleString('en-PH', { minimumFractionDigits: 2 })}` : null],
              ['Payment Date', ocr.payment_date],
              ['Reference Number', ocr.reference_number],
              ['Bank Name', ocr.bank_name],
              ['Payer Name', ocr.payer_name],
              ['Payee Name', ocr.payee_name],
              ['Document Type', ocr.document_type],
            ] as [string, string | null | undefined][]).map(([label, value]) => (
              <div key={label} className="flex gap-2 text-sm">
                <dt className="w-36 shrink-0 text-slate-500">{label}</dt>
                <dd className="font-medium text-slate-800">{value ?? <span className="text-slate-300">—</span>}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="text-slate-400 text-sm italic">No extracted fields.</p>
        )}
      </div>

      {/* Validation Checks */}
      <div>
        <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Validation Checks</h4>
        {checks.length > 0 ? (
          <ul className="space-y-2">
            {checks.map((check, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <span className={`mt-0.5 shrink-0 text-base ${check.passed ? 'text-green-500' : 'text-red-500'}`}>
                  {check.passed ? '✓' : '✗'}
                </span>
                <div>
                  <span className="font-medium text-slate-700">{check.check}</span>
                  {(!check.passed && check.expected != null) && (
                    <div className="text-xs text-slate-500 mt-0.5">
                      Expected: <span className="font-mono">{check.expected}</span>
                      {check.actual != null && (
                        <> · Got: <span className="font-mono text-red-600">{check.actual}</span></>
                      )}
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-slate-400 text-sm italic">No validation checks.</p>
        )}
      </div>
    </div>
  )
}

export function DocumentVerification() {
  const [docs, setDocs] = useState<DocumentRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<number | null>(null)

  const fetchDocs = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/documents')
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

  const toggleExpand = (id: number) => {
    setExpandedId(prev => (prev === id ? null : id))
  }

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
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-100">
              {loading && (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-slate-400">Loading documents...</td>
                </tr>
              )}
              {!loading && error && (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-red-500">{error}</td>
                </tr>
              )}
              {!loading && !error && docs.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-slate-400">No documents found.</td>
                </tr>
              )}
              {!loading && !error && docs.map((doc) => {
                const isExpanded = expandedId === doc.document_id
                const validPassed = doc.validation_result?.is_valid

                return (
                  <>
                    <tr
                      key={doc.document_id}
                      onClick={() => toggleExpand(doc.document_id)}
                      className="hover:bg-blue-50 cursor-pointer transition-colors"
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
                    </tr>
                    {isExpanded && (
                      <tr key={`${doc.document_id}-expand`}>
                        <td colSpan={6} className="p-0">
                          <OcrPanel
                            ocr={doc.ocr_result}
                            validation={doc.validation_result}
                          />
                        </td>
                      </tr>
                    )}
                  </>
                )
              })}
            </tbody>
          </table>
        </div>

        {!loading && !error && docs.length > 0 && (
          <div className="border-t border-slate-100 bg-slate-50 px-4 py-2 text-xs text-slate-500">
            {docs.length} document{docs.length !== 1 ? 's' : ''} · Click a row to view OCR details
          </div>
        )}
      </div>
    </div>
  )
}
