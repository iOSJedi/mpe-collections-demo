import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth-middleware'
import { db } from '@/db'
import { sql } from 'drizzle-orm'
import type { WorkflowEventType } from '@/types'

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

    // Use raw SQL to bypass Drizzle ORM mapping issues with pg-proxy
    const statusResult = await db.execute(
      sql.raw(`SELECT workflow_status FROM supplier_invoices_col WHERE supplier_invoice_id = ${supplierInvoiceId} LIMIT 1`)
    )

    const statusRows = statusResult as unknown as { workflow_status: string }[]
    if (!statusRows.length) {
      return NextResponse.json({ error: 'Supplier invoice not found' }, { status: 404 })
    }

    const currentStatus = statusRows[0].workflow_status

    const eventsResult = await db.execute(
      sql.raw(`SELECT event_id, supplier_invoice_id, po_id, event_type, event_data, performed_by, notes, created_at FROM ap_workflow_events_col WHERE supplier_invoice_id = ${supplierInvoiceId} ORDER BY created_at ASC`)
    )

    const eventRows = eventsResult as unknown as {
      event_id: number
      supplier_invoice_id: number
      po_id: number
      event_type: string
      event_data: string | Record<string, unknown> | null
      performed_by: string | null
      notes: string | null
      created_at: string
    }[]

    const events = eventRows.map((r) => {
      let eventData: Record<string, unknown> | null = null
      if (r.event_data) {
        if (typeof r.event_data === 'string') {
          try { eventData = JSON.parse(r.event_data) } catch { eventData = null }
        } else {
          eventData = r.event_data
        }
      }
      return {
        eventId: r.event_id,
        supplierInvoiceId: r.supplier_invoice_id,
        poId: r.po_id,
        eventType: r.event_type as WorkflowEventType,
        eventData,
        performedBy: r.performed_by ?? null,
        notes: r.notes ?? null,
        createdAt: String(r.created_at ?? ''),
      }
    })

    const completedEventTypes = new Set(events.map((e) => e.eventType))
    const futureSteps = WORKFLOW_STEPS.filter((step) => !completedEventTypes.has(step))

    return NextResponse.json({
      events,
      currentStatus,
      futureSteps,
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error('Failed to fetch timeline:', msg)
    return NextResponse.json({ error: `Failed to fetch timeline: ${msg}` }, { status: 500 })
  }
}
