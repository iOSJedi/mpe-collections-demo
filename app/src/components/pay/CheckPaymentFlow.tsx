'use client'

import { useState, useRef, DragEvent } from 'react'
import { Loader2, CheckCircle2, Upload, FileText, ClipboardList } from 'lucide-react'

interface CheckPaymentFlowProps {
  customerId: number
  amount: number
  invoiceId: number
  onComplete: () => void
}

type Step = 'details' | 'upload' | 'success'

interface ExtractedFields {
  checkNumber: string
  amount: string
  bank: string
  date: string
  depositor: string
  reference: string
}

const PAYEE_INFO = {
  name: 'Ayala Land Corporation',
  bank: 'BPI — Makati Main Branch',
  accountNumber: '1234-5678-90',
}

export function CheckPaymentFlow({ customerId, amount, invoiceId, onComplete }: CheckPaymentFlowProps) {
  const [step, setStep] = useState<Step>('details')
  const [checkNumber, setCheckNumber] = useState('')
  const [bankIssuer, setBankIssuer] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [clearanceDate, setClearanceDate] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Mock AI extraction preview based on form inputs
  const extractedFields: ExtractedFields = {
    checkNumber: checkNumber || '—',
    amount: amount ? `₱${amount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}` : '—',
    bank: bankIssuer || '—',
    date: new Date().toLocaleDateString('en-PH'),
    depositor: 'Ayala Land Corporation',
    reference: `INV-${invoiceId}`,
  }

  function handleDragOver(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setIsDragging(true)
  }

  function handleDragLeave(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setIsDragging(false)
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setIsDragging(false)
    const dropped = e.dataTransfer.files?.[0]
    if (dropped) setFile(dropped)
  }

  async function handleSubmit() {
    if (!file) {
      setError('Please upload a deposit slip before submitting.')
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      // 1. Create PENDING_CLEARANCE payment record
      const confirmRes = await fetch('/api/pay/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentMethod: 'CHECK',
          checkNumber: checkNumber || null,
          amount,
          invoiceId,
          customerId,
        }),
      })

      const confirmData = await confirmRes.json()
      if (!confirmRes.ok) {
        setError(confirmData.error ?? 'Failed to submit check payment.')
        return
      }

      setClearanceDate(confirmData.clearanceDate ?? null)
      const paymentId = confirmData.paymentId ?? null

      // 2. Upload deposit slip
      const formData = new FormData()
      formData.append('file', file)
      formData.append('customerId', String(customerId))
      formData.append('invoiceId', String(invoiceId))
      if (paymentId) formData.append('paymentId', String(paymentId))

      await fetch('/api/documents', {
        method: 'POST',
        body: formData,
      })
      // Non-fatal if upload fails — payment is already recorded

      setStep('success')
    } catch {
      setError('Failed to submit check payment. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  // ── Step 1: Check Details ───────────────────────────────────────
  if (step === 'details') {
    return (
      <div className="space-y-5">
        {/* Payee info */}
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-3">
          <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
            <ClipboardList className="h-4 w-4 text-[#003B1F]" />
            Make Check Payable To
          </h3>
          <div className="space-y-2">
            <div>
              <p className="text-xs text-slate-500">Account Name</p>
              <p className="text-sm font-medium text-slate-800">{PAYEE_INFO.name}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Bank / Branch</p>
              <p className="text-sm font-medium text-slate-800">{PAYEE_INFO.bank}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Account Number</p>
              <p className="text-sm font-medium text-slate-800">{PAYEE_INFO.accountNumber}</p>
            </div>
          </div>
        </div>

        {/* Amount display */}
        <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-3">
          <span className="text-sm text-slate-600 font-medium">Check Amount</span>
          <span className="text-base font-bold text-[#003B1F]">
            ₱{amount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
          </span>
        </div>

        {/* Check number input */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-slate-700" htmlFor="check-number">
            Check Number <span className="text-slate-400 font-normal">(optional)</span>
          </label>
          <input
            id="check-number"
            type="text"
            value={checkNumber}
            onChange={(e) => setCheckNumber(e.target.value)}
            placeholder="e.g. 001234"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#003B1F]/30 focus:border-[#003B1F]"
          />
        </div>

        {/* Bank/issuer input */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-slate-700" htmlFor="bank-issuer">
            Bank / Issuer <span className="text-slate-400 font-normal">(optional)</span>
          </label>
          <input
            id="bank-issuer"
            type="text"
            value={bankIssuer}
            onChange={(e) => setBankIssuer(e.target.value)}
            placeholder="e.g. BDO Unibank"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#003B1F]/30 focus:border-[#003B1F]"
          />
        </div>

        {/* Clearing notice */}
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-xs text-amber-800">
            <span className="font-semibold">Note:</span> Check payments have a 3 business day clearing period before funds are confirmed.
          </p>
        </div>

        {/* Continue button */}
        <button
          onClick={() => setStep('upload')}
          className="w-full py-3 rounded-lg bg-[#003B1F] hover:bg-[#003B1F]/90 text-white text-sm font-medium transition-colors"
        >
          Continue to Upload Deposit Slip
        </button>
      </div>
    )
  }

  // ── Step 2: Upload Deposit Slip ─────────────────────────────────
  if (step === 'upload') {
    return (
      <div className="space-y-5">
        {/* Back link */}
        <button
          onClick={() => setStep('details')}
          className="text-xs text-[#003B1F] hover:underline"
        >
          ← Back to check details
        </button>

        {/* File upload area */}
        <div>
          <p className="text-sm font-medium text-slate-700 mb-2">Upload Deposit Slip</p>
          <div
            className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
              isDragging
                ? 'border-[#003B1F] bg-[#003B1F]/5'
                : 'border-slate-300 hover:border-[#003B1F]'
            }`}
            onClick={() => fileInputRef.current?.click()}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            {file ? (
              <div className="flex flex-col items-center gap-2">
                <FileText className="h-8 w-8 text-[#003B1F]" />
                <p className="text-sm font-medium text-slate-700">{file.name}</p>
                <p className="text-xs text-slate-400">Click to change file</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <Upload className="h-8 w-8 text-slate-400" />
                <p className="text-sm text-slate-600">Drag & drop or click to upload</p>
                <p className="text-xs text-slate-400">PNG, JPG, PDF up to 10MB</p>
              </div>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,.pdf"
            className="hidden"
            onChange={(e) => {
              const selected = e.target.files?.[0]
              if (selected) setFile(selected)
            }}
          />
        </div>

        {/* AI extraction preview */}
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-3">
            AI Extraction Preview
          </p>
          <div className="space-y-2">
            {(
              [
                ['Check Number', extractedFields.checkNumber],
                ['Amount', extractedFields.amount],
                ['Bank', extractedFields.bank],
                ['Date', extractedFields.date],
                ['Depositor', extractedFields.depositor],
                ['Reference', extractedFields.reference],
              ] as [string, string][]
            ).map(([label, value]) => (
              <div key={label} className="flex items-center justify-between gap-2">
                <span className="text-xs text-slate-500">{label}</span>
                <span className="text-xs font-medium text-slate-800 text-right">{value}</span>
              </div>
            ))}
          </div>
        </div>

        {error && (
          <p className="text-sm text-red-600 rounded-md bg-red-50 border border-red-200 px-3 py-2">
            {error}
          </p>
        )}

        {/* Submit button */}
        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="w-full py-3 rounded-lg bg-[#003B1F] hover:bg-[#003B1F]/90 text-white text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
        >
          {submitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Submitting...
            </>
          ) : (
            'Submit Check Payment'
          )}
        </button>
      </div>
    )
  }

  // ── Step 3: Success ─────────────────────────────────────────────
  return (
    <div className="flex flex-col items-center gap-4 py-6 text-center">
      <CheckCircle2 className="h-12 w-12 text-green-600" />
      <div className="space-y-1">
        <p className="text-base font-semibold text-green-700">Check Payment Submitted!</p>
        <p className="text-sm text-slate-600">
          Your check payment has been recorded and is pending clearance.
        </p>
      </div>
      {clearanceDate && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 w-full text-left space-y-1">
          <p className="text-xs text-slate-500">Expected Clearance Date</p>
          <p className="text-sm font-semibold text-slate-800">
            {new Date(clearanceDate + 'T00:00:00').toLocaleDateString('en-PH', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </p>
          <p className="text-xs text-slate-400">3 business days from submission</p>
        </div>
      )}
      <p className="text-xs text-slate-500">
        Our team will verify your deposit slip and confirm your payment once the check clears.
      </p>
      <button
        onClick={onComplete}
        className="mt-2 text-sm text-[#003B1F] hover:underline font-medium"
      >
        Done
      </button>
    </div>
  )
}
