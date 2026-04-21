import { db } from '@/db'
import { cwtCertificates, customers, invoices } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { TenantInboxPreview } from '@/components/cwt/TenantInboxPreview'
import Link from 'next/link'

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [c] = await db.select().from(cwtCertificates)
    .where(eq(cwtCertificates.certificateId, Number(id))).limit(1)
  if (!c) return <div className="p-8">Not found</div>

  const [cust] = await db.select().from(customers)
    .where(eq(customers.customerId, c.customerId)).limit(1)
  const [inv] = c.invoiceId
    ? await db.select().from(invoices).where(eq(invoices.invoiceId, c.invoiceId)).limit(1)
    : [undefined]

  const tenantEmail = cust?.authorizedSignatoryEmail ?? 'tenant@example.com'
  const payorName = cust?.name?.replace(' (Demo Corp)', '') ?? 'Tenant'
  const peso = (v: string | number) => '₱' + Number(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const fmtDate = (s: string | null | undefined) => {
    if (!s) return '—'
    const d = s.slice(0, 10).split('-')
    return `${d[1]}/${d[2]}/${d[0]}`
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Top bar */}
      <div className="bg-white border-b">
        <div className="max-w-screen-2xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link href="/collections/cwt" className="text-sm text-slate-500 hover:text-slate-900">← Certificates</Link>
            <div className="h-5 w-px bg-slate-300" />
            <div>
              <div className="text-xs text-slate-500 uppercase tracking-wider">Reference</div>
              <div className="text-lg font-mono font-semibold">{c.referenceNumber}</div>
            </div>
            <span className="ml-2 px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700">{c.status}</span>
          </div>
          <div className="flex items-center gap-3">
            <a href={`/api/cwt/${c.certificateId}/pdf`} download={`BIR-2307-${c.referenceNumber}.pdf`}
               className="text-sm text-slate-600 hover:text-slate-900 hover:underline">Download</a>
            <TenantInboxPreview tenantEmail={tenantEmail} referenceNumber={c.referenceNumber} />
          </div>
        </div>
      </div>

      {/* Split layout */}
      <div className="max-w-screen-2xl mx-auto p-6 grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-6">
        {/* LEFT — Actual PDF in an iframe */}
        <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
          <div className="px-4 py-2 border-b text-xs uppercase tracking-widest text-slate-500 flex items-center justify-between">
            <span>BIR Form 2307 — Certificate of Creditable Tax Withheld at Source</span>
            <a href={`/api/cwt/${c.certificateId}/pdf`} target="_blank" rel="noopener noreferrer"
               className="text-blue-600 hover:underline text-xs normal-case tracking-normal">Open in new tab →</a>
          </div>
          <iframe
            src={`/api/cwt/${c.certificateId}/pdf#toolbar=0&navpanes=0`}
            className="w-full h-[1100px] bg-white"
            title="BIR 2307 PDF"
          />
        </div>

        {/* RIGHT — HTML summary */}
        <div className="space-y-4">
          <div className="bg-white rounded-lg border shadow-sm p-5">
            <div className="text-xs uppercase tracking-widest text-slate-500 mb-3">Summary</div>

            <div className="space-y-4">
              <div>
                <div className="text-[11px] uppercase tracking-widest text-slate-500">Period</div>
                <div className="text-sm font-medium">{fmtDate(c.periodStart)} — {fmtDate(c.periodEnd)}</div>
              </div>

              <div className="border-t pt-3">
                <div className="text-[11px] uppercase tracking-widest text-slate-500">Payee</div>
                <div className="text-sm font-semibold">Ayala Land, Inc.</div>
                <div className="text-xs text-slate-600">TIN 000-000-000-000</div>
              </div>

              <div className="border-t pt-3">
                <div className="text-[11px] uppercase tracking-widest text-slate-500">Payor (Withholding Agent)</div>
                <div className="text-sm font-semibold">{payorName}</div>
                <div className="text-xs text-slate-600">TIN {cust?.tin ?? '—'}</div>
                {cust?.branchCode && <div className="text-xs text-slate-600">Branch {cust.branchCode} · RDO {cust.rdoCode ?? '—'}</div>}
              </div>

              <div className="border-t pt-3 grid grid-cols-2 gap-3">
                <div>
                  <div className="text-[11px] uppercase tracking-widest text-slate-500">ATC</div>
                  <div className="text-sm font-mono font-semibold text-blue-600">{c.atcCode}</div>
                </div>
                <div>
                  <div className="text-[11px] uppercase tracking-widest text-slate-500">Rate</div>
                  <div className="text-sm font-semibold">{Number(c.ratePct).toFixed(2)}%</div>
                </div>
                <div>
                  <div className="text-[11px] uppercase tracking-widest text-slate-500">Gross payment</div>
                  <div className="text-sm font-semibold">{peso(c.grossAmount)}</div>
                </div>
                <div>
                  <div className="text-[11px] uppercase tracking-widest text-slate-500">Tax withheld</div>
                  <div className="text-sm font-semibold text-blue-600">{peso(c.withheldAmount)}</div>
                </div>
              </div>

              {inv && (
                <div className="border-t pt-3">
                  <div className="text-[11px] uppercase tracking-widest text-slate-500">Closed invoice</div>
                  <Link href={`/receivable/${inv.invoiceId}`}
                        className="text-sm font-mono text-blue-600 hover:underline">
                    {inv.invoiceNumber}
                  </Link>
                  <div className="text-xs text-slate-600">{peso(inv.amount)}</div>
                </div>
              )}

              <div className="border-t pt-3">
                <div className="text-[11px] uppercase tracking-widest text-slate-500 mb-1">Signatory</div>
                {cust?.signatureImageUrl ? (
                  <img src={cust.signatureImageUrl} alt="signature" className="h-10 -mb-1" />
                ) : (
                  <div className="h-10 w-40 border-b border-slate-400" />
                )}
                <div className="text-sm font-semibold mt-1">{c.signedByName ?? '—'}</div>
                <div className="text-xs text-slate-600">for {payorName}</div>
              </div>

              <div className="border-t pt-3">
                <div className="text-[11px] uppercase tracking-widest text-slate-500">Source</div>
                <div className="text-xs">
                  {c.source === 'AUTO_ENROLLED'
                    ? 'Auto-issued on payment (enrolled tenant)'
                    : c.source === 'OCR_INGESTED'
                    ? 'OCR-ingested from emailed 2307'
                    : 'Manual entry'}
                </div>
                {c.issuedAt && (
                  <div className="text-xs text-slate-500 mt-1">
                    Issued {String(c.issuedAt).slice(0, 10)}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="bg-blue-50 rounded-lg border border-blue-100 p-4 text-xs text-slate-700">
            Issued automatically by Ayala Land Inc. under <strong>RA 8792</strong> and <strong>RR 16-2021</strong> durable authorization granted by the tenant at enrollment.
          </div>
        </div>
      </div>
    </div>
  )
}
