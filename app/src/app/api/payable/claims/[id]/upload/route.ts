import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth-middleware'
import { db } from '@/db'
import { supplierInvoices, apWorkflowEvents } from '@/db/schema'
import { eq } from 'drizzle-orm'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await verifyToken(request)
  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  try {
    const { id } = await params
    const supplierInvoiceId = parseInt(id, 10)
    if (isNaN(supplierInvoiceId)) {
      return NextResponse.json({ error: 'Invalid invoice ID' }, { status: 400 })
    }

    const body = await request.json()
    const { documentUrl } = body

    if (!documentUrl) {
      return NextResponse.json({ error: 'Missing required field: documentUrl' }, { status: 400 })
    }

    // Fetch the invoice to get poId and verify it exists
    const [invoice] = await db
      .select({ supplierInvoiceId: supplierInvoices.supplierInvoiceId, poId: supplierInvoices.poId })
      .from(supplierInvoices)
      .where(eq(supplierInvoices.supplierInvoiceId, supplierInvoiceId))

    if (!invoice) {
      return NextResponse.json({ error: 'Supplier invoice not found' }, { status: 404 })
    }

    // Update claimDocumentUrl on the supplier invoice
    const [updated] = await db
      .update(supplierInvoices)
      .set({ claimDocumentUrl: documentUrl })
      .where(eq(supplierInvoices.supplierInvoiceId, supplierInvoiceId))
      .returning()

    // Fire DELIVERY_REPORT_UPLOADED event
    await db.insert(apWorkflowEvents).values({
      supplierInvoiceId,
      poId: invoice.poId,
      eventType: 'DELIVERY_REPORT_UPLOADED',
      eventData: null,
      performedBy: user.email ?? user.uid,
      notes: null,
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Failed to upload delivery report:', error)
    return NextResponse.json({ error: 'Failed to upload delivery report' }, { status: 500 })
  }
}
