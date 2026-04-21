import { db } from '@/db'
import { cwtCertificates, customers, invoices } from '@/db/schema'
import { desc, eq } from 'drizzle-orm'
import { CertificateQueue } from '@/components/cwt/CertificateQueue'

export default async function Page() {
  const rows = await db.select({
    c: cwtCertificates, cust: customers, inv: invoices,
  }).from(cwtCertificates)
    .leftJoin(customers, eq(customers.customerId, cwtCertificates.customerId))
    .leftJoin(invoices,  eq(invoices.invoiceId,   cwtCertificates.invoiceId))
    .orderBy(desc(cwtCertificates.issuedAt))
    .limit(100)

  return <CertificateQueue rows={rows.map(r => ({
    id: r.c.certificateId,
    referenceNumber: r.c.referenceNumber,
    tenantName: r.cust?.name ?? '', tenantTin: r.cust?.tin ?? '',
    invoiceNumber: r.inv?.invoiceNumber ?? '', atcCode: r.c.atcCode,
    withheldAmount: r.c.withheldAmount, issuedAt: r.c.issuedAt, status: r.c.status, source: r.c.source,
  }))} />
}
