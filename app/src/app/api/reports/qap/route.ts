import { db } from '@/db'
import { cwtCertificates, customers } from '@/db/schema'
import { desc, eq, and, gte, lte } from 'drizzle-orm'
import { buildQapCsv } from '@/lib/cwt/qap'
import { NextRequest } from 'next/server'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const periodStart = searchParams.get('from') ?? new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)
  const periodEnd = searchParams.get('to') ?? new Date().toISOString().slice(0, 10)

  const rows = await db.select({
    atcCode: cwtCertificates.atcCode,
    payorTin: customers.tin,
    payorBranchCode: customers.branchCode,
    payorName: customers.name,
    grossAmount: cwtCertificates.grossAmount,
    withheldAmount: cwtCertificates.withheldAmount,
    periodEnd: cwtCertificates.periodEnd,
    referenceNumber: cwtCertificates.referenceNumber,
  }).from(cwtCertificates).leftJoin(customers, eq(customers.customerId, cwtCertificates.customerId))
    .where(and(
      eq(cwtCertificates.status, 'ISSUED'),
      gte(cwtCertificates.periodEnd, periodStart),
      lte(cwtCertificates.periodEnd, periodEnd),
    )).orderBy(desc(cwtCertificates.periodEnd))

  const csv = buildQapCsv(rows as any)
  return new Response(csv, { headers: {
    'Content-Type': 'text/csv',
    'Content-Disposition': `attachment; filename="QAP-${periodStart}-${periodEnd}.csv"`,
  } })
}
