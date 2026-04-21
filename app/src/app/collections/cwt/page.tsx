import { db } from '@/db'
import { cwtCertificates, customers, invoices } from '@/db/schema'
import { desc, inArray } from 'drizzle-orm'
import { CertificateQueue } from '@/components/cwt/CertificateQueue'

export default async function Page() {
  // Flat selects sidestep a drizzle pg-proxy nested-select bug on nullable timestamps.
  const certs = await db.select({
    certificateId: cwtCertificates.certificateId,
    customerId: cwtCertificates.customerId,
    invoiceId: cwtCertificates.invoiceId,
    referenceNumber: cwtCertificates.referenceNumber,
    atcCode: cwtCertificates.atcCode,
    withheldAmount: cwtCertificates.withheldAmount,
    issuedAt: cwtCertificates.issuedAt,
    status: cwtCertificates.status,
    source: cwtCertificates.source,
  }).from(cwtCertificates)
    .orderBy(desc(cwtCertificates.issuedAt))
    .limit(100)

  const custIds = Array.from(new Set(certs.map(c => c.customerId).filter(Boolean))) as number[]
  const invIds  = Array.from(new Set(certs.map(c => c.invoiceId).filter(Boolean))) as number[]

  const custs = custIds.length
    ? await db.select({ customerId: customers.customerId, name: customers.name, tin: customers.tin })
        .from(customers).where(inArray(customers.customerId, custIds))
    : []
  const invs = invIds.length
    ? await db.select({ invoiceId: invoices.invoiceId, invoiceNumber: invoices.invoiceNumber })
        .from(invoices).where(inArray(invoices.invoiceId, invIds))
    : []

  const custById = new Map(custs.map(c => [c.customerId, c]))
  const invById  = new Map(invs.map(i => [i.invoiceId, i]))

  return <CertificateQueue rows={certs.map(c => ({
    id: c.certificateId,
    referenceNumber: c.referenceNumber,
    tenantName: custById.get(c.customerId)?.name ?? '',
    tenantTin:  custById.get(c.customerId)?.tin ?? '',
    invoiceNumber: invById.get(c.invoiceId)?.invoiceNumber ?? '',
    atcCode: c.atcCode,
    withheldAmount: c.withheldAmount,
    issuedAt: c.issuedAt,
    status: c.status,
    source: c.source,
  }))} />
}
