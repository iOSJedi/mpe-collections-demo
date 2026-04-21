import { db } from '@/db'
import { cwtCertificates, customers } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { Bir2307Preview } from '@/components/cwt/Bir2307Preview'
import { TenantInboxPreview } from '@/components/cwt/TenantInboxPreview'

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const rows = await db.select({ c: cwtCertificates, cust: customers })
    .from(cwtCertificates)
    .leftJoin(customers, eq(customers.customerId, cwtCertificates.customerId))
    .where(eq(cwtCertificates.certificateId, Number(id)))
    .limit(1)
  const row = rows[0]
  if (!row) return <div className="p-8">Not found</div>
  const c = row.c
  const tenantEmail = row.cust?.authorizedSignatoryEmail ?? 'tenant@example.com'
  return (
    <div className="p-8 space-y-4">
      <div className="flex items-end justify-between gap-4">
        <div>
          <div className="text-sm text-slate-500">Reference</div>
          <div className="text-2xl font-mono">{c.referenceNumber}</div>
        </div>
        <TenantInboxPreview tenantEmail={tenantEmail} referenceNumber={c.referenceNumber} />
      </div>
      <Bir2307Preview pdfDataUrl={c.pdfUrl ?? ''} />
    </div>
  )
}
