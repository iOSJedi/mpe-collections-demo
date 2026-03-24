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
      .select({
        eventId: apWorkflowEvents.eventId,
        supplierInvoiceId: apWorkflowEvents.supplierInvoiceId,
        poId: apWorkflowEvents.poId,
        eventType: apWorkflowEvents.eventType,
        eventData: apWorkflowEvents.eventData,
        performedBy: apWorkflowEvents.performedBy,
        notes: apWorkflowEvents.notes,
        createdAt: apWorkflowEvents.createdAt,
      })
      .from(apWorkflowEvents)
      .where(eq(apWorkflowEvents.supplierInvoiceId, supplierInvoiceId))
      .orderBy(asc(apWorkflowEvents.createdAt))

    const events: WorkflowEvent[] = eventRows.map((r) => {
      // eventData may be double-encoded JSON string from pg-proxy
      let eventData: Record<string, unknown> | null = null
      if (r.eventData) {
        eventData = typeof r.eventData === 'string' ? JSON.parse(r.eventData) : r.eventData as Record<string, unknown>
      }
      return {
        eventId: r.eventId,
        supplierInvoiceId: r.supplierInvoiceId,
        poId: r.poId,
        eventType: r.eventType as WorkflowEventType,
        eventData,
        performedBy: r.performedBy ?? null,
        notes: r.notes ?? null,
        createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt ?? ''),
      }
    })

    // Compute future steps based on which steps have already occurred
    const completedEventTypes = new Set(events.map((e) => e.eventType))
    const futureSteps = WORKFLOW_STEPS.filter((step) => !completedEventTypes.has(step))

    return NextResponse.json({
      events,
      currentStatus: invoice.workflowStatus,
      futureSteps,
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    const stack = error instanceof Error ? error.stack : undefined
    console.error('Failed to fetch timeline:', msg, stack)
    return NextResponse.json({ error: `Failed to fetch timeline: ${msg}` }, { status: 500 })
  }
}
