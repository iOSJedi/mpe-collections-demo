import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth-middleware'
import { db } from '@/db'
import { supplierInvoices, apWorkflowEvents } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { invalidateCache } from '@/lib/cache'

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
    const { role } = body

    if (role !== 'AP_CLERK' && role !== 'FINANCE_MANAGER') {
      return NextResponse.json({ error: 'Invalid role. Must be AP_CLERK or FINANCE_MANAGER' }, { status: 400 })
    }

    // Fetch the invoice to get poId and verify it exists
    const [invoice] = await db
      .select({ supplierInvoiceId: supplierInvoices.supplierInvoiceId, poId: supplierInvoices.poId })
      .from(supplierInvoices)
      .where(eq(supplierInvoices.supplierInvoiceId, supplierInvoiceId))

    if (!invoice) {
      return NextResponse.json({ error: 'Supplier invoice not found' }, { status: 404 })
    }

    const performedBy = user.email ?? user.uid
    const now = new Date()

    if (role === 'AP_CLERK') {
      // AP_CLERK approval: set workflowStatus to AP_APPROVED
      const [updated] = await db
        .update(supplierInvoices)
        .set({ workflowStatus: 'AP_APPROVED' })
        .where(eq(supplierInvoices.supplierInvoiceId, supplierInvoiceId))
        .returning()

      await db.insert(apWorkflowEvents).values({
        supplierInvoiceId,
        poId: invoice.poId,
        eventType: 'AP_CLERK_APPROVED',
        eventData: null,
        performedBy,
        notes: null,
      })

      invalidateCache('claims-list')
      return NextResponse.json(updated)
    } else {
      // FINANCE_MANAGER approval: FM_APPROVED → auto PAYMENT_SCHEDULED + PAYMENT_RELEASED → RELEASED
      const [updated] = await db
        .update(supplierInvoices)
        .set({ workflowStatus: 'RELEASED' })
        .where(eq(supplierInvoices.supplierInvoiceId, supplierInvoiceId))
        .returning()

      await db.insert(apWorkflowEvents).values([
        {
          supplierInvoiceId,
          poId: invoice.poId,
          eventType: 'FM_APPROVED',
          eventData: null,
          performedBy,
          notes: null,
        },
        {
          supplierInvoiceId,
          poId: invoice.poId,
          eventType: 'PAYMENT_SCHEDULED',
          eventData: { scheduledAt: now.toISOString() },
          performedBy,
          notes: null,
        },
        {
          supplierInvoiceId,
          poId: invoice.poId,
          eventType: 'PAYMENT_RELEASED',
          eventData: { releasedAt: now.toISOString() },
          performedBy,
          notes: null,
        },
      ])

      invalidateCache('claims-list')
      return NextResponse.json(updated)
    }
  } catch (error) {
    console.error('Failed to approve claim:', error)
    return NextResponse.json({ error: 'Failed to approve claim' }, { status: 500 })
  }
}
