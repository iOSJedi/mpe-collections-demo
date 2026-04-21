import { NextResponse } from 'next/server'
import { db } from '@/db'
import { incomingPayments } from '@/db/schema'
import { isNull, and, ne } from 'drizzle-orm'
import { tryAutoIssueForPayment } from '@/lib/cwt/issue'

export async function POST() {
  const pending = await db.select().from(incomingPayments).where(
    and(isNull(incomingPayments.cwtCertificateId), ne(incomingPayments.paymentMethod, 'CWT'))
  ).limit(50)
  const results: any[] = []
  for (const p of pending) {
    results.push({ paymentId: p.paymentId, ...(await tryAutoIssueForPayment(p.paymentId)) })
  }
  return NextResponse.json({ processed: results.length, results })
}
