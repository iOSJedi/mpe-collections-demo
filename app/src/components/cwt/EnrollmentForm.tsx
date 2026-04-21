'use client'
import { useState } from 'react'
import { SignaturePad } from './SignaturePad'
import { useRouter } from 'next/navigation'

export function EnrollmentForm({ customerId, qrToken }: { customerId: number; qrToken: string }) {
  const router = useRouter()
  const [state, setState] = useState({
    tin: '', branchCode: '000', rdoCode: '',
    companyAddress: '', zipCode: '',
    taxClassification: 'PRIVATE' as 'PRIVATE' | 'GOVT',
    signatoryName: '', signatoryEmail: '',
    signatureDataUrl: null as string | null,
    tinProofDataUrl: null as string | null,
    consents: { accurate: false, disclose: false, alerts: false, dpa: false, authorize: false },
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const readFile = (f: File) => new Promise<string>(res => {
    const r = new FileReader(); r.onload = () => res(r.result as string); r.readAsDataURL(f)
  })

  const submit = async () => {
    setSubmitting(true); setError(null)
    try {
      const res = await fetch('/api/cwt/enroll', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId, qrToken, ...state }),
      })
      if (!res.ok) throw new Error((await res.json()).error ?? 'failed')
      router.push(`/pay/enroll/success?customerId=${customerId}`)
    } catch (e: any) { setError(e.message) } finally { setSubmitting(false) }
  }

  const allReqConsents = state.consents.accurate && state.consents.disclose && state.consents.dpa && state.consents.authorize

  return (
    <form onSubmit={e => { e.preventDefault(); submit() }} className="max-w-2xl mx-auto py-10 space-y-8 px-6">
      <section>
        <h2 className="text-xl font-semibold">Company information</h2>
        <div className="grid grid-cols-2 gap-3 mt-4">
          <input required placeholder="TIN (###-###-###-###)" value={state.tin}
            onChange={e => setState(s => ({ ...s, tin: e.target.value }))}
            className="border rounded px-3 py-2" />
          <input required placeholder="Branch code" value={state.branchCode}
            onChange={e => setState(s => ({ ...s, branchCode: e.target.value }))}
            className="border rounded px-3 py-2" />
          <input required placeholder="RDO code" value={state.rdoCode}
            onChange={e => setState(s => ({ ...s, rdoCode: e.target.value }))}
            className="border rounded px-3 py-2" />
          <select value={state.taxClassification}
            onChange={e => setState(s => ({ ...s, taxClassification: e.target.value as any }))}
            className="border rounded px-3 py-2">
            <option value="PRIVATE">Private</option><option value="GOVT">Government</option>
          </select>
          <input required placeholder="Registered address" value={state.companyAddress}
            onChange={e => setState(s => ({ ...s, companyAddress: e.target.value }))}
            className="border rounded px-3 py-2 col-span-2" />
          <input required placeholder="ZIP code" value={state.zipCode}
            onChange={e => setState(s => ({ ...s, zipCode: e.target.value }))}
            className="border rounded px-3 py-2" />
        </div>
      </section>

      <section>
        <h2 className="text-xl font-semibold">Proof of TIN</h2>
        <p className="text-sm text-slate-500 mb-2">Upload BIR Form 2303 or a sample OR (PDF/PNG/JPEG, ≤ 5 MB).</p>
        <input type="file" accept="application/pdf,image/png,image/jpeg"
          onChange={async e => { const f = e.target.files?.[0]; if (!f) return; const url = await readFile(f); setState(s => ({ ...s, tinProofDataUrl: url })) }} />
      </section>

      <section>
        <h2 className="text-xl font-semibold">Authorized signatory</h2>
        <div className="grid grid-cols-2 gap-3 mt-4">
          <input required placeholder="Name" value={state.signatoryName}
            onChange={e => setState(s => ({ ...s, signatoryName: e.target.value }))}
            className="border rounded px-3 py-2" />
          <input required type="email" placeholder="Email" value={state.signatoryEmail}
            onChange={e => setState(s => ({ ...s, signatoryEmail: e.target.value }))}
            className="border rounded px-3 py-2" />
        </div>
        <div className="mt-3">
          <label className="text-sm text-slate-600">Signature (sign below)</label>
          <SignaturePad onChange={dataUrl => setState(s => ({ ...s, signatureDataUrl: dataUrl }))} />
        </div>
      </section>

      <section>
        <h2 className="text-xl font-semibold">Declarations</h2>
        {[
          ['accurate', 'The information above is accurate and submitted voluntarily.'],
          ['disclose', 'We permit Ayala Land to disclose our data to its subsidiaries for portal access.'],
          ['alerts',   'We authorize email and SMS alerts regarding portal updates.'],
          ['dpa',      'We consent to data collection under the Data Privacy Act of 2012 and Ayala Land\'s privacy policy.'],
          ['authorize','We authorize Ayala Land\'s portal to generate, electronically sign with our stored signature, and deliver BIR Form 2307 on our behalf, in compliance with RA 8792 and RR 16-2021.'],
        ].map(([k, text]) => (
          <label key={k} className="flex items-start gap-2 mt-2">
            <input type="checkbox" className="mt-1"
              checked={(state.consents as any)[k]}
              onChange={e => setState(s => ({ ...s, consents: { ...s.consents, [k]: e.target.checked } }))} />
            <span className="text-sm">{text}</span>
          </label>
        ))}
      </section>

      {error && <div className="text-red-600 text-sm">{error}</div>}
      <button type="submit" disabled={!allReqConsents || !state.signatureDataUrl || !state.tinProofDataUrl || submitting}
        className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded py-2 disabled:bg-slate-300">
        {submitting ? 'Submitting...' : 'Enroll'}
      </button>
    </form>
  )
}
