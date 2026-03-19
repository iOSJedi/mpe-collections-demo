'use client'

import { useState } from 'react'
import { OcrResult, ValidationCheck, ValidationResult } from '@/types'

// ─── Field color palette for legend dots ───────────────────────────────────
const FIELD_COLORS: Record<string, string> = {
  payment_amount: '#4ade80',
  payment_date: '#60a5fa',
  reference_number: '#f59e0b',
  bank_name: '#a78bfa',
  payer_name: '#f472b6',
  payee_name: '#34d399',
  document_type: '#fb923c',
}

const FIELD_LABELS: Record<string, string> = {
  payment_amount: 'Payment Amount',
  payment_date: 'Payment Date',
  reference_number: 'Reference Number',
  bank_name: 'Bank Name',
  payer_name: 'Payer Name',
  payee_name: 'Payee Name',
  document_type: 'Document Type',
}

// Map check names to human-readable labels
function checkLabel(check: string): string {
  return check
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

function formatAmount(val: number | string | null | undefined): string {
  if (val == null) return '—'
  const num = typeof val === 'string' ? parseFloat(val) : val
  if (isNaN(num)) return String(val)
  return `₱${num.toLocaleString('en-PH', { minimumFractionDigits: 2 })}`
}

function formatOcrValue(key: string, val: unknown): string {
  if (val == null) return '—'
  if (key === 'payment_amount') return formatAmount(val as number)
  return String(val)
}

// ─── Confidence score calculation ──────────────────────────────────────────
function calcConfidence(checks: ValidationCheck[]): number {
  if (checks.length === 0) return 0
  const passed = checks.filter((c) => c.passed).length
  return Math.round((passed / checks.length) * 100)
}

function confidenceColor(score: number): string {
  if (score >= 85) return '#4ade80'
  if (score >= 60) return '#f59e0b'
  return '#ff6b6b'
}

// ─── Mismatch explanation ──────────────────────────────────────────────────
function mismatchExplanation(check: ValidationCheck): string | null {
  if (check.passed) return null
  if (check.expected != null && check.actual != null) {
    return `Expected ${check.expected} — got ${check.actual}`
  }
  if (check.expected != null) {
    return `Expected ${check.expected} — not found in document`
  }
  if (check.actual != null) {
    return `Extracted ${check.actual} — does not match`
  }
  return 'Value mismatch detected'
}

// ─── Props ──────────────────────────────────────────────────────────────────
interface DocumentViewerProps {
  document: {
    documentId: number
    fileUrl: string
    fileName: string
    fileType: string
    ocrResult: OcrResult | null
    ocrStatus: string
    validationResult: ValidationResult | null
  }
  customerName?: string
  invoiceNumber?: string
  expectedAmount?: number
  onConfirm?: () => void
  onFlag?: () => void
  onAcceptPartial?: () => void
  onEscalate?: () => void
}

// ─── Left column: Document image / placeholder ─────────────────────────────
function DocumentPane({
  fileUrl,
  fileName,
  fileType,
  ocrResult,
}: {
  fileUrl: string
  fileName: string
  fileType: string
  ocrResult: OcrResult | null
}) {
  const [zoomed, setZoomed] = useState(false)

  // Determine if this is a renderable image
  const isImage =
    fileUrl.startsWith('data:image') ||
    fileUrl.startsWith('data:application/octet-stream') ||
    /\.(png|jpe?g|gif|webp|bmp|svg)(\?|$)/i.test(fileUrl)

  const isPlaceholder =
    !fileUrl ||
    fileUrl === '#' ||
    fileUrl.startsWith('placeholder') ||
    (!fileUrl.startsWith('data:') && !fileUrl.startsWith('http') && !fileUrl.startsWith('/'))

  const extractedFields = ocrResult
    ? (Object.keys(FIELD_LABELS) as (keyof OcrResult)[]).filter(
        (k) => ocrResult[k] != null
      )
    : []

  return (
    <div className="flex flex-col gap-4">
      {/* Image / placeholder */}
      <div className="relative rounded-lg border border-[#2a2a3e] bg-[#13131f] overflow-hidden min-h-[280px] flex items-center justify-center">
        {isPlaceholder || !isImage ? (
          <div className="flex flex-col items-center justify-center gap-3 p-8 text-center">
            <div className="w-16 h-20 rounded border-2 border-dashed border-[#3a3a5e] flex items-center justify-center">
              <span className="text-[#5a5a8a] text-2xl">
                {fileType.includes('pdf') ? 'PDF' : 'IMG'}
              </span>
            </div>
            <p className="text-sm text-[#8888aa] font-medium break-all max-w-[200px]">
              {fileName}
            </p>
            <p className="text-xs text-[#5a5a8a]">{fileType || 'Unknown type'}</p>
          </div>
        ) : (
          <img
            src={fileUrl}
            alt={fileName}
            className="max-w-full max-h-[400px] object-contain transition-transform duration-200"
            style={{ transform: zoomed ? 'scale(1.8)' : 'scale(1)', cursor: zoomed ? 'zoom-out' : 'zoom-in' }}
            onClick={() => setZoomed((z) => !z)}
          />
        )}
      </div>

      {/* Controls: zoom + download */}
      <div className="flex items-center gap-3">
        {!isPlaceholder && isImage && (
          <button
            onClick={() => setZoomed((z) => !z)}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded border border-[#2a2a3e] text-[#8888aa] hover:border-[#4a4a6e] hover:text-[#aaaacc] transition-colors"
          >
            {zoomed ? (
              <>
                <span className="text-base leading-none">&#8722;</span> Zoom Out
              </>
            ) : (
              <>
                <span className="text-base leading-none">&#43;</span> Zoom In
              </>
            )}
          </button>
        )}
        {!isPlaceholder && (
          <a
            href={fileUrl}
            download={fileName}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded border border-[#2a2a3e] text-[#8888aa] hover:border-[#4a4a6e] hover:text-[#aaaacc] transition-colors"
          >
            <span>&#8595;</span> Download
          </a>
        )}
      </div>

      {/* Extracted field legend */}
      {extractedFields.length > 0 && (
        <div className="rounded-lg border border-[#2a2a3e] bg-[#16162a] p-3">
          <p className="text-[10px] font-semibold text-[#5a5a8a] uppercase tracking-wider mb-2">
            Extracted Fields
          </p>
          <div className="flex flex-wrap gap-x-4 gap-y-1.5">
            {extractedFields.map((key) => (
              <div key={key} className="flex items-center gap-1.5">
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: FIELD_COLORS[key] ?? '#8888aa' }}
                />
                <span className="text-xs text-[#8888aa]">{FIELD_LABELS[key]}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Right column: AI Analysis ─────────────────────────────────────────────
function AnalysisPane({
  ocrResult,
  validationResult,
  ocrStatus,
  onConfirm,
  onFlag,
  onAcceptPartial,
  onEscalate,
}: {
  ocrResult: OcrResult | null
  validationResult: ValidationResult | null
  ocrStatus: string
  onConfirm?: () => void
  onFlag?: () => void
  onAcceptPartial?: () => void
  onEscalate?: () => void
}) {
  const checks: ValidationCheck[] = validationResult?.checks ?? []
  const confidence = calcConfidence(checks)
  const color = confidenceColor(confidence)
  const allPassed = checks.length > 0 && checks.every((c) => c.passed)
  const anyMismatch = checks.some((c) => !c.passed)

  const ocrFields = ocrResult
    ? (Object.keys(FIELD_LABELS) as (keyof OcrResult)[]).filter(
        (k) => ocrResult[k] != null
      )
    : []

  // Find a matching check for a given OCR field key (by fuzzy check name match)
  function getCheckForField(fieldKey: string): ValidationCheck | undefined {
    if (!checks.length) return undefined
    const label = fieldKey.replace(/_/g, ' ').toLowerCase()
    return checks.find((c) => c.check.toLowerCase().includes(label.split(' ')[0]))
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Overall confidence */}
      <div className="rounded-lg border border-[#2a2a3e] bg-[#16162a] p-4 flex items-center gap-5">
        <div className="shrink-0">
          <span
            className="text-5xl font-bold tabular-nums leading-none"
            style={{ color }}
          >
            {checks.length === 0 ? '—' : `${confidence}%`}
          </span>
        </div>
        <div>
          <p className="text-sm font-semibold text-[#ccccee]">Overall Confidence</p>
          <p className="text-xs text-[#6666aa] mt-0.5">
            {checks.length === 0
              ? ocrStatus === 'PENDING'
                ? 'OCR processing pending'
                : 'No validation checks available'
              : `${checks.filter((c) => c.passed).length} of ${checks.length} checks passed`}
          </p>
        </div>
      </div>

      {/* Extracted fields as cards */}
      {ocrFields.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold text-[#5a5a8a] uppercase tracking-wider mb-2 px-1">
            Extracted Fields
          </p>
          <div className="space-y-2">
            {ocrFields.map((key) => {
              const value = ocrResult![key]
              const check = getCheckForField(key)
              const hasCheck = check != null
              const passed = hasCheck ? check.passed : null
              const explanation = hasCheck ? mismatchExplanation(check) : null

              let indicatorColor = '#60a5fa' // blue = new/no expected
              let indicatorLabel = 'New'
              if (hasCheck && passed) {
                indicatorColor = '#4ade80'
                indicatorLabel = 'Match'
              } else if (hasCheck && !passed) {
                indicatorColor = '#ff6b6b'
                indicatorLabel = 'Mismatch'
              }

              return (
                <div
                  key={key}
                  className="rounded-lg border border-[#2a2a3e] bg-[#1c1c2e] px-3 py-2.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] text-[#6666aa] mb-0.5">{FIELD_LABELS[key]}</p>
                      <p className="text-sm font-semibold text-[#e0e0f0] break-words">
                        {formatOcrValue(key, value)}
                      </p>
                      {explanation && (
                        <p className="text-[11px] text-[#ff8888] mt-1">{explanation}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0 mt-0.5">
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: indicatorColor }}
                      />
                      <span
                        className="text-[11px] font-medium"
                        style={{ color: indicatorColor }}
                      >
                        {indicatorLabel}
                      </span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Remaining validation checks not tied to OCR fields */}
      {checks.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold text-[#5a5a8a] uppercase tracking-wider mb-2 px-1">
            All Validation Checks
          </p>
          <div className="space-y-1.5">
            {checks.map((check, i) => {
              const explanation = mismatchExplanation(check)
              return (
                <div key={i} className="flex items-start gap-2.5 rounded-lg px-3 py-2 bg-[#1a1a2e] border border-[#22223a]">
                  <span
                    className="w-2 h-2 rounded-full mt-1 shrink-0"
                    style={{ backgroundColor: check.passed ? '#4ade80' : '#ff6b6b' }}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-[#ccccee]">
                      {checkLabel(check.check)}
                    </p>
                    {!check.passed && explanation && (
                      <p className="text-[11px] text-[#ff8888] mt-0.5">{explanation}</p>
                    )}
                  </div>
                  <span
                    className="text-[11px] font-medium shrink-0"
                    style={{ color: check.passed ? '#4ade80' : '#ff6b6b' }}
                  >
                    {check.passed ? 'Pass' : 'Fail'}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* No data state */}
      {ocrFields.length === 0 && checks.length === 0 && (
        <div className="rounded-lg border border-[#2a2a3e] bg-[#16162a] p-6 text-center">
          <p className="text-sm text-[#5a5a8a] italic">
            {ocrStatus === 'PENDING'
              ? 'OCR analysis in progress...'
              : ocrStatus === 'FAILED'
              ? 'OCR analysis failed. Please re-upload the document.'
              : 'No analysis data available.'}
          </p>
        </div>
      )}

      {/* Action buttons */}
      {(onConfirm || onFlag || onAcceptPartial || onEscalate) && (
        <div className="flex flex-wrap gap-2 pt-1">
          {allPassed && onConfirm && (
            <button
              onClick={onConfirm}
              className="flex-1 min-w-[120px] px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors"
              style={{ backgroundColor: '#16a34a' }}
              onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#15803d')}
              onMouseOut={(e) => (e.currentTarget.style.backgroundColor = '#16a34a')}
            >
              Confirm Payment
            </button>
          )}
          {allPassed && onFlag && (
            <button
              onClick={onFlag}
              className="flex-1 min-w-[120px] px-4 py-2 rounded-lg text-sm font-medium border transition-colors"
              style={{ borderColor: '#4ade80', color: '#4ade80' }}
              onMouseOver={(e) => {
                e.currentTarget.style.backgroundColor = '#4ade8015'
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent'
              }}
            >
              Flag for Review
            </button>
          )}
          {anyMismatch && onAcceptPartial && (
            <button
              onClick={onAcceptPartial}
              className="flex-1 min-w-[120px] px-4 py-2 rounded-lg text-sm font-medium border transition-colors"
              style={{ borderColor: '#f59e0b', color: '#f59e0b' }}
              onMouseOver={(e) => {
                e.currentTarget.style.backgroundColor = '#f59e0b15'
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent'
              }}
            >
              Accept as Partial
            </button>
          )}
          {anyMismatch && onEscalate && (
            <button
              onClick={onEscalate}
              className="flex-1 min-w-[120px] px-4 py-2 rounded-lg text-sm font-medium border transition-colors"
              style={{ borderColor: '#ff6b6b', color: '#ff6b6b' }}
              onMouseOver={(e) => {
                e.currentTarget.style.backgroundColor = '#ff6b6b15'
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent'
              }}
            >
              Escalate
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Main component ────────────────────────────────────────────────────────
export function DocumentViewer({
  document: doc,
  customerName,
  invoiceNumber,
  expectedAmount,
  onConfirm,
  onFlag,
  onAcceptPartial,
  onEscalate,
}: DocumentViewerProps) {
  return (
    <div className="rounded-xl border border-[#2a2a3e] bg-[#13131f] overflow-hidden">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 px-5 py-4 border-b border-[#2a2a3e] bg-[#16162a]">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-[#e0e0f0] truncate">{doc.fileName}</h3>
          <div className="flex flex-wrap gap-3 mt-1 text-xs text-[#6666aa]">
            {customerName && <span>Customer: <span className="text-[#aaaacc]">{customerName}</span></span>}
            {invoiceNumber && <span>Invoice: <span className="text-[#aaaacc] font-mono">{invoiceNumber}</span></span>}
            {expectedAmount != null && (
              <span>
                Expected: <span className="text-[#aaaacc]">{formatAmount(expectedAmount)}</span>
              </span>
            )}
          </div>
        </div>
        <div className="shrink-0">
          <span
            className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium border"
            style={
              doc.ocrStatus === 'COMPLETED'
                ? { borderColor: '#4ade8040', backgroundColor: '#4ade8015', color: '#4ade80' }
                : doc.ocrStatus === 'FAILED'
                ? { borderColor: '#ff6b6b40', backgroundColor: '#ff6b6b15', color: '#ff6b6b' }
                : { borderColor: '#f59e0b40', backgroundColor: '#f59e0b15', color: '#f59e0b' }
            }
          >
            {doc.ocrStatus}
          </span>
        </div>
      </div>

      {/* Two-column body */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-[#2a2a3e]">
        {/* Left: Document */}
        <div className="bg-[#13131f] p-5">
          <p className="text-[10px] font-semibold text-[#5a5a8a] uppercase tracking-wider mb-3">
            Document
          </p>
          <DocumentPane
            fileUrl={doc.fileUrl}
            fileName={doc.fileName}
            fileType={doc.fileType}
            ocrResult={doc.ocrResult}
          />
        </div>

        {/* Right: AI Analysis */}
        <div className="bg-[#13131f] p-5">
          <p className="text-[10px] font-semibold text-[#5a5a8a] uppercase tracking-wider mb-3">
            AI Analysis
          </p>
          <AnalysisPane
            ocrResult={doc.ocrResult}
            validationResult={doc.validationResult}
            ocrStatus={doc.ocrStatus}
            onConfirm={onConfirm}
            onFlag={onFlag}
            onAcceptPartial={onAcceptPartial}
            onEscalate={onEscalate}
          />
        </div>
      </div>
    </div>
  )
}
