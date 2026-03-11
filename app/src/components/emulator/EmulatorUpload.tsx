'use client'

import { useRef, useState, DragEvent, ChangeEvent } from 'react'

interface OcrResult {
  payment_amount: number | null
  payment_date: string | null
  reference_number: string | null
  bank_name: string | null
  payee_name: string | null
  payer_name: string | null
  document_type: string | null
}

interface ValidationCheck {
  check: string
  passed: boolean
  expected: string | null
  actual: string | null
  severity: 'info' | 'warning' | 'critical'
}

interface ValidationResult {
  is_valid: boolean
  checks: ValidationCheck[]
}

interface OcrDocumentResult {
  ocr_result: OcrResult | null
  validation_result: ValidationResult | null
  ocr_status: string
}

interface EmulatorUploadProps {
  customerId: number
  invoiceId: number | null
}

export function EmulatorUpload({ customerId, invoiceId }: EmulatorUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<'idle' | 'uploading' | 'ocr' | 'done' | 'error'>('idle')
  const [ocrResult, setOcrResult] = useState<OcrDocumentResult | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const handleFileSelect = (file: File) => {
    setSelectedFile(file)
    setUploadProgress('idle')
    setOcrResult(null)
    setErrorMessage(null)
  }

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFileSelect(file)
  }

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) handleFileSelect(file)
  }

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setDragOver(true)
  }

  const handleDragLeave = () => {
    setDragOver(false)
  }

  const handleUpload = async () => {
    if (!selectedFile) return

    setUploading(true)
    setErrorMessage(null)
    setUploadProgress('uploading')

    try {
      // Step 1: Upload document
      const formData = new FormData()
      formData.append('file', selectedFile)
      formData.append('customerId', String(customerId))
      if (invoiceId) {
        formData.append('invoiceId', String(invoiceId))
      }

      const uploadRes = await fetch('/api/documents', {
        method: 'POST',
        body: formData,
      })

      if (!uploadRes.ok) {
        const errData = await uploadRes.json()
        throw new Error(errData.error || 'Upload failed')
      }

      const uploadedDoc = await uploadRes.json()
      const documentId = uploadedDoc.document_id ?? uploadedDoc.documentId

      // Step 2: Trigger OCR
      setUploadProgress('ocr')

      const ocrRes = await fetch('/api/ocr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentId }),
      })

      if (!ocrRes.ok) {
        const errData = await ocrRes.json()
        throw new Error(errData.error || 'OCR failed')
      }

      const ocrDoc: OcrDocumentResult = await ocrRes.json()
      setOcrResult(ocrDoc)
      setUploadProgress('done')
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Something went wrong')
      setUploadProgress('error')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Drag-and-drop zone */}
      <div
        onClick={() => fileInputRef.current?.click()}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={`
          cursor-pointer rounded-lg border-2 border-dashed p-6 text-center transition-colors
          ${dragOver ? 'border-[#C5A930] bg-[#C5A930]/5' : 'border-border hover:border-[#C5A930]/50'}
        `}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,application/pdf"
          className="hidden"
          onChange={handleInputChange}
        />
        {selectedFile ? (
          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground truncate">{selectedFile.name}</p>
            <p className="text-xs text-muted-foreground">
              {(selectedFile.size / 1024).toFixed(1)} KB · {selectedFile.type || 'unknown type'}
            </p>
            <p className="text-xs text-muted-foreground">Click to change file</p>
          </div>
        ) : (
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Drop a file here or click to browse</p>
            <p className="text-xs text-muted-foreground">Accepts images and PDF</p>
          </div>
        )}
      </div>

      {/* Invoice context notice */}
      {invoiceId && (
        <p className="text-xs text-muted-foreground">
          Uploading proof for invoice ID <span className="font-medium text-foreground">#{invoiceId}</span>
        </p>
      )}

      {/* Upload button */}
      <button
        onClick={handleUpload}
        disabled={!selectedFile || uploading}
        className="w-full rounded border text-sm px-3 py-2 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        style={{ borderColor: '#C5A930', color: '#C5A930' }}
      >
        {uploadProgress === 'uploading' && 'Uploading...'}
        {uploadProgress === 'ocr' && 'Running OCR...'}
        {uploadProgress === 'done' && 'Done!'}
        {uploadProgress === 'error' && 'Retry Upload'}
        {uploadProgress === 'idle' && 'Upload & Run OCR'}
      </button>

      {/* Progress indicator */}
      {(uploadProgress === 'uploading' || uploadProgress === 'ocr') && (
        <div className="space-y-1">
          <div className="flex gap-2 text-xs text-muted-foreground">
            <span className={uploadProgress === 'uploading' || uploadProgress === 'ocr' ? 'text-[#C5A930]' : ''}>
              1. Uploading document
            </span>
            <span>·</span>
            <span className={uploadProgress === 'ocr' ? 'text-[#C5A930]' : ''}>
              2. Running OCR
            </span>
          </div>
          <div className="h-1 w-full rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: uploadProgress === 'uploading' ? '40%' : '90%',
                backgroundColor: '#C5A930',
              }}
            />
          </div>
        </div>
      )}

      {/* Error */}
      {uploadProgress === 'error' && errorMessage && (
        <div className="rounded border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {errorMessage}
        </div>
      )}

      {/* OCR Result */}
      {uploadProgress === 'done' && ocrResult && (
        <div className="rounded-lg border border-border bg-white p-3 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-foreground">OCR Result</p>
            {ocrResult.validation_result && (
              <span
                className={`text-xs font-medium px-2 py-0.5 rounded border ${
                  ocrResult.validation_result.is_valid
                    ? 'border-success/30 bg-success/10 text-success'
                    : 'border-destructive/30 bg-destructive/10 text-destructive'
                }`}
              >
                {ocrResult.validation_result.is_valid ? 'Valid' : 'Invalid'}
              </span>
            )}
          </div>

          {ocrResult.ocr_result && (
            <div className="space-y-1 text-xs">
              {Object.entries(ocrResult.ocr_result).map(([key, value]) =>
                value !== null ? (
                  <div key={key} className="flex justify-between gap-2">
                    <span className="text-muted-foreground capitalize">{key.replace(/_/g, ' ')}</span>
                    <span className="font-medium text-foreground truncate max-w-[140px]">{String(value)}</span>
                  </div>
                ) : null
              )}
            </div>
          )}

          {ocrResult.validation_result?.checks && ocrResult.validation_result.checks.length > 0 && (
            <div className="border-t border-border pt-2 space-y-1">
              <p className="text-xs font-medium text-foreground mb-1">Validation Checks</p>
              {ocrResult.validation_result.checks.map((check, i) => (
                <div key={i} className="flex items-start gap-2 text-xs">
                  <span className={check.passed ? 'text-success' : 'text-destructive'}>
                    {check.passed ? '✓' : '✗'}
                  </span>
                  <span className={check.passed ? 'text-muted-foreground' : 'text-foreground'}>
                    {check.check}
                    {!check.passed && check.expected && (
                      <span className="text-muted-foreground ml-1">
                        (expected: {check.expected})
                      </span>
                    )}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
