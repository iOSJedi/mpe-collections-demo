'use client'

import { useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import type { PaymentWithAllocations, DocumentRecord } from '@/types'
import { formatCurrency } from '@/lib/utils'
import { DocumentViewer } from '@/components/documents/DocumentViewer'

// ─── Badge helpers ────────────────────────────────────────────────────────────

const STATUS_BADGE: Record<string, string> = {
  CONFIRMED: 'bg-green-100 text-green-800',
  PENDING: 'bg-amber-100 text-amber-800',
  FAILED: 'bg-red-100 text-red-800',
  CANCELLED: 'bg-gray-100 text-gray-500',
}

const METHOD_BADGE: Record<string, string> = {
  BANK_TRANSFER: 'bg-blue-100 text-blue-800',
  GCash: 'bg-sky-100 text-sky-800',
  CHECK: 'bg-amber-100 text-amber-800',
  STRIPE: 'bg-violet-100 text-violet-800',
  CASH: 'bg-green-100 text-green-800',
}

const ALLOC_TYPE_BADGE: Record<string, string> = {
  PRINCIPAL: 'bg-slate-100 text-slate-700',
  PENALTY: 'bg-orange-100 text-orange-700',
}

function Badge({ label, className }: { label: string; className?: string }) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
        className ?? 'bg-slate-100 text-slate-700'
      }`}
    >
      {label}
    </span>
  )
}

// ─── Document viewer dialog ────────────────────────────────────────────────────

function DocumentDialog({
  doc,
  customerName,
}: {
  doc: DocumentRecord
  customerName?: string
}) {
  const [open, setOpen] = useState(false)

  const viewerDoc = {
    documentId: doc.document_id,
    fileUrl: doc.file_url,
    fileName: doc.file_name,
    fileType: doc.file_type,
    ocrResult: doc.ocr_result,
    ocrStatus: doc.ocr_status,
    validationResult: doc.validation_result,
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button className="flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded border border-blue-300 text-blue-600 hover:bg-blue-50 transition-colors">
          View Document
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 z-40" />
        <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-xl shadow-2xl focus:outline-none">
          <div className="flex items-center justify-between px-5 py-3 bg-[#1c1c2e] border-b border-[#2a2a3e]">
            <Dialog.Title className="text-sm font-semibold text-[#e0e0f0]">
              Payment Proof — {doc.file_name}
            </Dialog.Title>
            <Dialog.Close asChild>
              <button className="text-[#6666aa] hover:text-[#aaaacc] text-xl leading-none">&times;</button>
            </Dialog.Close>
          </div>
          <DocumentViewer
            document={viewerDoc}
            customerName={customerName ?? doc.customer_name}
            invoiceNumber={doc.invoice_number ?? undefined}
          />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

// ─── Payment card ─────────────────────────────────────────────────────────────

function PaymentCard({
  payment,
  document: doc,
  customerName,
}: {
  payment: PaymentWithAllocations
  document?: DocumentRecord
  customerName?: string
}) {
  const formattedDate = payment.paymentDate
    ? new Date(payment.paymentDate).toLocaleDateString('en-PH', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : '—'

  return (
    <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
      {/* Payment header */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 bg-slate-50 border-b border-slate-100">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-xs text-slate-500">#{payment.paymentId}</span>
          <span className="text-sm text-slate-600">{formattedDate}</span>
          <Badge
            label={payment.paymentMethod}
            className={METHOD_BADGE[payment.paymentMethod]}
          />
          <Badge
            label={payment.status}
            className={STATUS_BADGE[payment.status]}
          />
          {doc && (
            <DocumentDialog doc={doc} customerName={customerName} />
          )}
        </div>
        <span className="text-sm font-bold text-slate-800">
          {formatCurrency(payment.amount)}
        </span>
      </div>

      {/* Reference number */}
      {payment.referenceNumber && (
        <div className="px-4 py-1.5 bg-white border-b border-slate-50">
          <span className="text-xs text-slate-400">Ref: </span>
          <span className="font-mono text-xs text-slate-600">{payment.referenceNumber}</span>
        </div>
      )}

      {/* Allocations */}
      {payment.allocations.length > 0 && (
        <div className="divide-y divide-slate-50">
          {payment.allocations.map((alloc) => {
            const invoiceRef = `INV-${String(alloc.invoiceId).padStart(4, '0')}`
            const isFullySettled =
              alloc.allocationType === 'PRINCIPAL' &&
              payment.allocations
                .filter(
                  (a) =>
                    a.invoiceId === alloc.invoiceId && a.allocationType === 'PRINCIPAL'
                )
                .reduce((s, a) => s + a.amount, 0) >= alloc.amount

            return (
              <div
                key={alloc.allocationId}
                className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 text-sm"
              >
                <div className="flex items-center gap-2">
                  <Badge
                    label={alloc.allocationType}
                    className={ALLOC_TYPE_BADGE[alloc.allocationType]}
                  />
                  <span className="font-mono text-xs text-slate-500">{invoiceRef}</span>
                  {alloc.penaltyId != null && (
                    <span className="text-xs text-slate-400">
                      (penalty #{alloc.penaltyId})
                    </span>
                  )}
                  {isFullySettled && (
                    <span className="text-xs text-green-600 font-medium">
                      → {invoiceRef} fully settled
                    </span>
                  )}
                </div>
                <span className="text-slate-700 font-medium text-xs">
                  {formatCurrency(alloc.amount)}
                </span>
              </div>
            )
          })}
        </div>
      )}

      {payment.allocations.length === 0 && (
        <div className="px-4 py-2 text-xs text-slate-400 italic">No allocations recorded.</div>
      )}
    </div>
  )
}

// ─── Main component ──────────────────────────────────────────────────────────

export function PaymentAllocations({
  payments,
  documents = [],
  customerName,
}: {
  payments: PaymentWithAllocations[]
  documents?: DocumentRecord[]
  customerName?: string
}) {
  // Build a map from paymentId → DocumentRecord
  const docByPaymentId = new Map<number, DocumentRecord>()
  for (const doc of documents) {
    if (doc.payment_id != null) {
      docByPaymentId.set(doc.payment_id, doc)
    }
  }

  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden">
      <div className="px-4 py-3 bg-slate-50 border-b border-slate-200">
        <span className="font-semibold text-slate-700 text-sm">
          Payment History ({payments.length})
        </span>
      </div>
      <div className="p-4 space-y-3">
        {payments.length === 0 ? (
          <p className="text-slate-400 text-sm text-center py-4">No payment history found.</p>
        ) : (
          payments.map((payment) => (
            <PaymentCard
              key={payment.paymentId}
              payment={payment}
              document={docByPaymentId.get(payment.paymentId)}
              customerName={customerName}
            />
          ))
        )}
      </div>
    </div>
  )
}
