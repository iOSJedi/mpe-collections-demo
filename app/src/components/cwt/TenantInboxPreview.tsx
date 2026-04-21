'use client'
import { useState } from 'react'
export function TenantInboxPreview({ tenantEmail, referenceNumber }: { tenantEmail: string; referenceNumber: string }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button onClick={() => setOpen(true)} className="text-sm text-blue-600 hover:underline">Tenant inbox preview →</button>
      {open && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-6 z-50" onClick={() => setOpen(false)}>
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full p-6 space-y-3" onClick={e => e.stopPropagation()}>
            <div className="text-xs text-slate-400">Gmail — Inbox</div>
            <div className="flex items-center justify-between border-b pb-2">
              <div>
                <div className="font-medium">BIR 2307 — ref {referenceNumber}</div>
                <div className="text-xs text-slate-500">noreply@ayalaland.com.ph → {tenantEmail}</div>
              </div>
              <div className="text-xs text-slate-400">just now</div>
            </div>
            <div className="text-sm">Your BIR Form 2307 for the recent lease payment has been generated on your behalf under the authorization you granted at enrollment. A signed copy is attached for your records.</div>
            <div className="flex items-center gap-2 border rounded p-2 text-sm">📎 BIR-2307-{referenceNumber}.pdf</div>
          </div>
        </div>
      )}
    </>
  )
}
