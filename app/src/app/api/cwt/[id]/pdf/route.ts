import { NextRequest } from 'next/server'
import { db } from '@/db'
import { cwtCertificates } from '@/db/schema'
import { eq } from 'drizzle-orm'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [c] = await db.select({ pdfUrl: cwtCertificates.pdfUrl, referenceNumber: cwtCertificates.referenceNumber })
    .from(cwtCertificates).where(eq(cwtCertificates.certificateId, Number(id))).limit(1)
  if (!c?.pdfUrl) return new Response('Not found', { status: 404 })

  const match = c.pdfUrl.match(/^data:application\/pdf;base64,(.+)$/)
  if (!match) return new Response('Bad PDF payload', { status: 500 })

  const bytes = Buffer.from(match[1], 'base64')
  return new Response(bytes, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="BIR-2307-${c.referenceNumber}.pdf"`,
      'Cache-Control': 'no-cache',
    },
  })
}
