import { db } from '@/db'
import { cwtCertificates } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { Bir2307Preview } from '@/components/cwt/Bir2307Preview'

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [c] = await db.select().from(cwtCertificates).where(eq(cwtCertificates.certificateId, Number(id)))
  if (!c) return <div className="p-8">Not found</div>
  return (
    <div className="p-8 space-y-4">
      <div>
        <div className="text-sm text-slate-500">Reference</div>
        <div className="text-2xl font-mono">{c.referenceNumber}</div>
      </div>
      <Bir2307Preview pdfDataUrl={c.pdfUrl ?? ''} />
    </div>
  )
}
