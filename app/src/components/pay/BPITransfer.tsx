'use client'

import { useState, useRef } from 'react'
import { Loader2, CheckCircle2, Upload, Copy, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface BPITransferProps {
  customerId: number
  invoiceId: number
}

const BPI_DETAILS = {
  accountName: 'Ayala Land Corporation',
  accountNumber: '1234-5678-90',
  bank: 'Bank of the Philippine Islands',
  branch: 'Makati Main Branch',
}

export function BPITransfer({ customerId, invoiceId }: BPITransferProps) {
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploaded, setUploaded] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copiedField, setCopiedField] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function copyToClipboard(value: string, field: string) {
    navigator.clipboard.writeText(value).then(() => {
      setCopiedField(field)
      setTimeout(() => setCopiedField(null), 2000)
    })
  }

  async function handleUpload() {
    if (!file) {
      setError('Please select a receipt file to upload.')
      return
    }

    setUploading(true)
    setError(null)

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('customerId', String(customerId))
      formData.append('invoiceId', String(invoiceId))

      const res = await fetch('/api/documents', {
        method: 'POST',
        body: formData,
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.error ?? 'Failed to upload receipt.')
        return
      }

      setUploaded(true)
    } catch {
      setError('Failed to upload receipt. Please try again.')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Bank account details */}
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-3">
        <h3 className="text-sm font-semibold text-slate-700">Bank Transfer Details</h3>

        {[
          { label: 'Account Name', value: BPI_DETAILS.accountName, field: 'name' },
          { label: 'Account Number', value: BPI_DETAILS.accountNumber, field: 'number' },
          { label: 'Bank', value: BPI_DETAILS.bank, field: 'bank' },
          { label: 'Branch', value: BPI_DETAILS.branch, field: 'branch' },
        ].map(({ label, value, field }) => (
          <div key={field} className="flex items-center justify-between gap-2">
            <div>
              <p className="text-xs text-slate-500">{label}</p>
              <p className="text-sm font-medium text-slate-800">{value}</p>
            </div>
            <button
              onClick={() => copyToClipboard(value, field)}
              className="flex-shrink-0 p-1 rounded text-slate-400 hover:text-slate-600 transition-colors"
              title={`Copy ${label}`}
            >
              {copiedField === field ? (
                <Check className="h-4 w-4 text-green-500" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </button>
          </div>
        ))}
      </div>

      {/* Instructions */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-slate-700">Instructions</h3>
        <ol className="space-y-1 text-sm text-slate-600 list-decimal list-inside">
          <li>Log in to your BPI online banking or visit the nearest BPI branch.</li>
          <li>Transfer the exact invoice amount to the account above.</li>
          <li>Save or screenshot your transfer receipt/confirmation.</li>
          <li>Upload the receipt below for verification.</li>
        </ol>
      </div>

      {/* Receipt upload */}
      {uploaded ? (
        <div className="flex flex-col items-center gap-3 py-4 text-center">
          <CheckCircle2 className="h-10 w-10 text-green-600" />
          <p className="text-sm font-semibold text-green-700">Receipt uploaded successfully!</p>
          <p className="text-xs text-slate-500">
            Our team will verify your payment within 1–2 business days.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-slate-700">Upload Transfer Receipt</h3>

          <div
            className="border-2 border-dashed border-slate-300 rounded-lg p-6 text-center cursor-pointer hover:border-[#003B1F] transition-colors"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="h-8 w-8 text-slate-400 mx-auto mb-2" />
            {file ? (
              <p className="text-sm text-slate-700 font-medium">{file.name}</p>
            ) : (
              <>
                <p className="text-sm text-slate-600">Click to upload receipt</p>
                <p className="text-xs text-slate-400 mt-1">PNG, JPG, PDF up to 10MB</p>
              </>
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

          {error && (
            <p className="text-sm text-red-600 rounded-md bg-red-50 border border-red-200 px-3 py-2">
              {error}
            </p>
          )}

          <Button
            onClick={handleUpload}
            disabled={!file || uploading}
            className="w-full bg-[#003B1F] hover:bg-[#003B1F]/90 text-white"
            size="lg"
          >
            {uploading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Uploading...
              </>
            ) : (
              'Submit Receipt'
            )}
          </Button>
        </div>
      )}
    </div>
  )
}
