'use client'

import { useEffect, useState } from 'react'

interface QrData {
  qrDataUrl: string
  encodedUrl: string
  expiresAt: string
  invoiceNumber?: string
  amount?: number
  contractNumber?: string
  accountNumber?: string
}

interface EmulatorQRProps {
  invoiceId: number | null
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(amount)
}

export function EmulatorQR({ invoiceId }: EmulatorQRProps) {
  const [qrData, setQrData] = useState<QrData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!invoiceId) {
      setQrData(null)
      return
    }

    setLoading(true)
    setError(null)
    setQrData(null)

    fetch('/api/qr', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ invoiceId }),
    })
      .then((res) => {
        if (!res.ok) throw new Error('Failed to generate QR code')
        return res.json()
      })
      .then((data) => {
        setQrData(data)
        setLoading(false)
      })
      .catch((err) => {
        setError(err.message)
        setLoading(false)
      })
  }, [invoiceId])

  const handleCopy = () => {
    if (!qrData?.encodedUrl) return
    navigator.clipboard.writeText(qrData.encodedUrl).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  if (!invoiceId) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-sm text-muted-foreground gap-2">
        <span>Select an invoice and click "Show QR"</span>
        <span className="text-xs">from the Invoices tab to generate a QR code.</span>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
        Generating QR code...
      </div>
    )
  }

  if (error) {
    return (
      <div className="py-6 text-sm text-destructive text-center">{error}</div>
    )
  }

  if (!qrData) return null

  return (
    <div className="flex flex-col items-center gap-4 py-4">
      <div className="rounded-xl border border-border bg-white p-4 shadow-sm flex flex-col items-center gap-3 w-full">
        <img
          src={qrData.qrDataUrl}
          alt="Payment QR Code"
          className="w-48 h-48 object-contain"
        />

        <p className="text-xs text-muted-foreground text-center">
          Scan with your phone camera to pay
        </p>

        {(qrData.invoiceNumber || qrData.amount) && (
          <div className="w-full text-xs text-center space-y-1 border-t border-border pt-3">
            {qrData.invoiceNumber && (
              <div>
                <span className="text-muted-foreground">Invoice: </span>
                <span className="font-medium">{qrData.invoiceNumber}</span>
              </div>
            )}
            {qrData.amount !== undefined && (
              <div>
                <span className="text-muted-foreground">Amount: </span>
                <span className="font-medium">{formatCurrency(qrData.amount)}</span>
              </div>
            )}
            {qrData.contractNumber && (
              <div>
                <span className="text-muted-foreground">Contract: </span>
                <span className="font-medium">{qrData.contractNumber}</span>
              </div>
            )}
            {qrData.accountNumber && (
              <div>
                <span className="text-muted-foreground">Account: </span>
                <span className="font-medium">{qrData.accountNumber}</span>
              </div>
            )}
          </div>
        )}
      </div>

      <button
        onClick={handleCopy}
        className="w-full rounded border text-xs px-3 py-2 font-medium transition-colors hover:bg-[#C5A930]/10"
        style={{ borderColor: '#C5A930', color: '#C5A930' }}
      >
        {copied ? 'Copied!' : 'Copy Payment Link'}
      </button>

      <p className="text-xs text-muted-foreground text-center">
        Expires: {new Date(qrData.expiresAt).toLocaleString('en-PH')}
      </p>
    </div>
  )
}
