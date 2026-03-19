import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth-middleware'
import { db } from '@/db'
import { supplierInvoices, apWorkflowEvents } from '@/db/schema'
import { eq, asc } from 'drizzle-orm'
import type { WorkflowEvent, WorkflowEventType } from '@/types'

const WORKFLOW_STEPS: WorkflowEventType[] = [
  'CLAIM_SUBMITTED',
  'DELIVERY_REPORT_UPLOADED',
  'GR_CONFIRMED',
  'THREE_WAY_MATCH',
  'AP_CLERK_APPROVED',
  'FM_APPROVED',
  'PAYMENT_SCHEDULED',
  'PAYMENT_RELEASED',
]

export async function GET(
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

    // Verify invoice exists and get current status
    const [invoice] = await db
      .select({ workflowStatus: supplierInvoices.workflowStatus })
      .from(supplierInvoices)
      .where(eq(supplierInvoices.supplierInvoiceId, supplierInvoiceId))

    if (!invoice) {
      return NextResponse.json({ error: 'Supplier invoice not found' }, { status: 404 })
    }

    // Fetch all workflow events ordered by createdAt ASC
    const eventRows = await db
      .select()
      .from(apWorkflowEvents)
      .where(eq(apWorkflowEvents.supplierInvoiceId, supplierInvoiceId))
      .orderBy(asc(apWorkflowEvents.createdAt))

    const events: WorkflowEvent[] = eventRows.map((r) => ({
      eventId: r.eventId,
      supplierInvoiceId: r.supplierInvoiceId,
      poId: r.poId,
      eventType: r.eventType as WorkflowEventType,
      eventData: r.eventData as Record<string, unknown> | null,
      performedBy: r.performedBy ?? null,
      notes: r.notes ?? null,
      createdAt: r.createdAt?.toISOString() ?? '',
    }))

    // Compute future steps based on which steps have already occurred
    const completedEventTypes = new Set(events.map((e) => e.eventType))
    const futureSteps = WORKFLOW_STEPS.filter((step) => !completedEventTypes.has(step))

    return NextResponse.json({
      events,
      currentStatus: invoice.workflowStatus,
      futureSteps,
    })
  } catch (error) {
    console.error('Failed to fetch timeline:', error)
    return NextResponse.json({ error: 'Failed to fetch timeline' }, { status: 500 })
  }
}
