'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Row = {
  id: number; referenceNumber: string; tenantName: string; tenantTin: string;
  invoiceNumber: string; atcCode: string; withheldAmount: string;
  issuedAt: Date | null; status: string; source: string;
}

export function CertificateQueue({ rows }: { rows: Row[] }) {
  const [statusFilter, setStatus] = useState<'ALL' | 'ISSUED' | 'ESCALATED' | 'DRAFT'>('ALL')
  const filtered = statusFilter === 'ALL' ? rows : rows.filter(r => r.status === statusFilter)
  const total = filtered.reduce((s, r) => s + Number(r.withheldAmount), 0)
  const router = useRouter()

  return (
    <div className="p-8 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">BIR 2307 Certificates</h1>
        <div className="flex gap-2">
          {(['ALL','ISSUED','ESCALATED','DRAFT'] as const).map(s => (
            <button key={s} onClick={() => setStatus(s)}
              className={`px-3 py-1 rounded text-sm ${statusFilter===s ? 'bg-blue-600 text-white' : 'bg-slate-100'}`}>{s}</button>
          ))}
          <a href="/api/reports/qap" className="px-3 py-1 rounded bg-slate-900 text-white text-sm">Export QAP CSV</a>
        </div>
      </div>
      <div className="text-sm text-slate-500">{filtered.length} certificates · ₱{total.toLocaleString(undefined,{minimumFractionDigits:2})} withheld</div>
      <table className="w-full text-sm">
        <thead className="text-left text-slate-500 border-b">
          <tr><th className="py-2">Ref</th><th>Tenant</th><th>TIN</th><th>Invoice</th><th>ATC</th><th>Withheld</th><th>Issued</th><th>Status</th></tr>
        </thead>
        <tbody>
          {filtered.map(r => (
            <tr key={r.id} className="border-b hover:bg-slate-50 cursor-pointer" onClick={() => router.push(`/collections/cwt/${r.id}`)}>
              <td className="py-2 font-mono">{r.referenceNumber}</td>
              <td>{r.tenantName}</td><td>{r.tenantTin}</td>
              <td>{r.invoiceNumber}</td><td>{r.atcCode}</td>
              <td>₱{Number(r.withheldAmount).toLocaleString(undefined,{minimumFractionDigits:2})}</td>
              <td>{r.issuedAt?.toLocaleDateString?.() ?? ''}</td>
              <td><span className={`px-2 py-0.5 rounded text-xs ${r.status==='ISSUED'?'bg-green-100 text-green-700':r.status==='ESCALATED'?'bg-rose-100 text-rose-700':'bg-slate-100 text-slate-700'}`}>{r.status}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
