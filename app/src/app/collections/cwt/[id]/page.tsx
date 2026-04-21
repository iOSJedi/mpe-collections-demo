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

  const [cust] = await db.select({ authorizedSignatoryEmail: customers.authorizedSignatoryEmail })
    .from(customers).where(eq(customers.customerId, c.customerId)).limit(1)
  const tenantEmail = cust?.authorizedSignatoryEmail ?? 'tenant@example.com'

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
