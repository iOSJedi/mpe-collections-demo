import { db } from '@/db'
import { cwtCertificates, customers } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { Bir2307Preview } from '@/components/cwt/Bir2307Preview'
import { TenantInboxPreview } from '@/components/cwt/TenantInboxPreview'

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [c] = await db.select().from(cwtCertificates)
    .where(eq(cwtCertificates.certificateId, Number(id))).limit(1)
  if (!c) return <div className="p-8">Not found</div>

  const [cust] = await db.select().from(customers)
    .where(eq(customers.customerId, c.customerId)).limit(1)
  const tenantEmail = cust?.authorizedSignatoryEmail ?? 'tenant@example.com'

  return (
    <div className="p-8 space-y-4 bg-slate-50 min-h-screen">
      <div className="flex items-end justify-between gap-4 max-w-3xl mx-auto">
        <div>
          <div className="text-sm text-slate-500">Reference</div>
          <div className="text-2xl font-mono">{c.referenceNumber}</div>
        </div>
        <div className="flex items-center gap-3">
          {c.pdfUrl && (
            <a href={c.pdfUrl} target="_blank" rel="noopener noreferrer"
               className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded shadow-sm">
              View real BIR 2307 form →
            </a>
          )}
          <TenantInboxPreview tenantEmail={tenantEmail} referenceNumber={c.referenceNumber} />
        </div>
      </div>
      <Bir2307Preview
        data={{
          referenceNumber: c.referenceNumber,
          periodStart: c.periodStart,
          periodEnd: c.periodEnd,
          payeeName: 'Ayala Land, Inc.',
          payeeTin: '000-000-000-000',
          payorName: cust?.name?.replace(' (Demo Corp)', '') ?? 'Tenant',
          payorTin: cust?.tin ?? '—',
          atcCode: c.atcCode,
          grossAmount: c.grossAmount,
          withheldAmount: c.withheldAmount,
          signedByName: c.signedByName,
          signatureImageUrl: cust?.signatureImageUrl,
        }}
        pdfDataUrl={c.pdfUrl ?? undefined}
      />
    </div>
  )
}
