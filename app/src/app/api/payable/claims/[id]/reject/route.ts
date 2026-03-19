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
    const { role, notes } = body

    if (role !== 'AP_CLERK' && role !== 'FINANCE_MANAGER') {
      return NextResponse.json({ error: 'Invalid role. Must be AP_CLERK or FINANCE_MANAGER' }, { status: 400 })
    }

    if (!notes) {
      return NextResponse.json({ error: 'Missing required field: notes' }, { status: 400 })
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
    const eventType = role === 'AP_CLERK' ? 'AP_CLERK_REJECTED' : 'FM_REJECTED'

    // Set workflowStatus to REJECTED
    const [updated] = await db
      .update(supplierInvoices)
      .set({ workflowStatus: 'REJECTED' })
      .where(eq(supplierInvoices.supplierInvoiceId, supplierInvoiceId))
      .returning()

    // Fire rejection event with notes
    await db.insert(apWorkflowEvents).values({
      supplierInvoiceId,
      poId: invoice.poId,
      eventType,
      eventData: null,
      performedBy,
      notes,
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Failed to reject claim:', error)
    return NextResponse.json({ error: 'Failed to reject claim' }, { status: 500 })
  }
}
