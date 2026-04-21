'use client'

export interface Bir2307Data {
  referenceNumber: string
  periodStart: string
  periodEnd: string
  payeeName: string
  payeeTin: string
  payorName: string
  payorTin: string
  atcCode: string
  grossAmount: string
  withheldAmount: string
  signedByName?: string | null
  signatureImageUrl?: string | null
}

function mmddyyyy(iso: string): string {
  const date = iso.slice(0, 10)
  const [y, m, d] = date.split('-')
  return `${m}/${d}/${y}`
}

function peso(n: string): string {
  return '₱' + Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function Bir2307Preview({ data, pdfDataUrl }: { data?: Bir2307Data; pdfDataUrl?: string }) {
  if (!data) {
    return <div className="text-slate-500">(no certificate data)</div>
  }
  return (
    <div className="bg-white border rounded-lg shadow-sm p-10 max-w-3xl mx-auto font-sans text-[13px] text-slate-900">
      <div className="flex items-start justify-between border-b pb-3 mb-4">
        <div>
          <div className="text-[10px] uppercase tracking-widest text-slate-500">Republic of the Philippines · Bureau of Internal Revenue</div>
          <div className="text-base font-bold mt-1">BIR Form No. 2307</div>
          <div className="text-[11px] text-slate-600">Certificate of Creditable Tax Withheld at Source</div>
        </div>
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-widest text-slate-500">Reference</div>
          <div className="font-mono text-sm font-semibold">{data.referenceNumber}</div>
        </div>
      </div>

      <section className="mb-4">
        <div className="text-[10px] uppercase tracking-widest text-slate-500">For the Period</div>
        <div className="flex gap-6 mt-1">
          <div><span className="text-slate-500">From</span> <span className="font-medium">{mmddyyyy(data.periodStart)}</span></div>
          <div><span className="text-slate-500">To</span> <span className="font-medium">{mmddyyyy(data.periodEnd)}</span></div>
        </div>
      </section>

      <section className="mb-4 grid grid-cols-2 gap-4">
        <div>
          <div className="text-[10px] uppercase tracking-widest text-slate-500">Part I — Payee</div>
          <div className="font-semibold mt-1">{data.payeeName}</div>
          <div className="text-slate-600">TIN {data.payeeTin}</div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-widest text-slate-500">Part II — Payor (Withholding Agent)</div>
          <div className="font-semibold mt-1">{data.payorName}</div>
          <div className="text-slate-600">TIN {data.payorTin}</div>
        </div>
      </section>

      <section className="mb-4">
        <div className="text-[10px] uppercase tracking-widest text-slate-500 mb-1">Part III — Details of Monthly Income Payments and Tax Withheld</div>
        <table className="w-full border text-[12px]">
          <thead className="bg-slate-50">
            <tr>
              <th className="border px-3 py-2 text-left w-32">ATC</th>
              <th className="border px-3 py-2 text-right">Amount of Payment</th>
              <th className="border px-3 py-2 text-right">Tax Withheld</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="border px-3 py-2 font-mono">{data.atcCode}</td>
              <td className="border px-3 py-2 text-right">{peso(data.grossAmount)}</td>
              <td className="border px-3 py-2 text-right">{peso(data.withheldAmount)}</td>
            </tr>
            <tr className="bg-slate-50 font-semibold">
              <td className="border px-3 py-2">Total</td>
              <td className="border px-3 py-2"></td>
              <td className="border px-3 py-2 text-right">{peso(data.withheldAmount)}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section className="mt-6 pt-4 border-t">
        <div className="text-[10px] text-slate-500 mb-2">
          I declare, under the penalties of perjury, that this certificate has been made in good faith, verified by me, and to the best of my knowledge and belief, is true and correct.
        </div>
        <div className="flex items-end justify-between">
          <div>
            <div className="text-[10px] uppercase tracking-widest text-slate-500 mb-1">Signatory</div>
            {data.signatureImageUrl ? (
              <img src={data.signatureImageUrl} alt="signature" className="h-12 -mb-1" />
            ) : (
              <div className="h-12 w-48 border-b border-slate-400" />
            )}
            <div className="font-semibold mt-1">{data.signedByName ?? '—'}</div>
            <div className="text-[11px] text-slate-600">for {data.payorName}</div>
          </div>
          {pdfDataUrl && (
            <a href={pdfDataUrl} download={`BIR-2307-${data.referenceNumber}.pdf`}
               className="text-[11px] text-blue-600 hover:underline">Download PDF →</a>
          )}
        </div>
      </section>

      <div className="mt-6 text-[10px] text-slate-400 border-t pt-2">
        Issued automatically by Ayala Land Inc. under RA 8792 and RR 16-2021 durable authorization.
      </div>
    </div>
  )
}
