import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { escalations } from '@/db/schema'
import { eq } from 'drizzle-orm'

interface PatchBody {
  status?: 'IN_REVIEW' | 'RESOLVED' | 'DISMISSED'
  assigned_to?: string
  resolution_notes?: string
}

// PATCH /api/escalations/[id]
// Update escalation status, assigned_to, resolution_notes
// Sets resolved_at when status changes to RESOLVED or DISMISSED
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const escalationId = Number(id)
    if (isNaN(escalationId)) {
      return NextResponse.json({ error: 'Invalid escalation id' }, { status: 400 })
    }

    const body: PatchBody = await request.json()
    const { status, assigned_to, resolution_notes } = body

    const updateValues: Record<string, unknown> = {}

    if (status !== undefined) {
      updateValues.status = status
      if (status === 'RESOLVED' || status === 'DISMISSED') {
        updateValues.resolvedAt = new Date()
      }
    }

    if (assigned_to !== undefined) {
      updateValues.assignedTo = assigned_to
    }

    if (resolution_notes !== undefined) {
      updateValues.resolutionNotes = resolution_notes
    }

    if (Object.keys(updateValues).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
    }

    const [updated] = await db
      .update(escalations)
      .set(updateValues)
      .where(eq(escalations.escalationId, escalationId))
      .returning()

    if (!updated) {
      return NextResponse.json({ error: 'Escalation not found' }, { status: 404 })
    }

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Failed to update escalation:', error)
    return NextResponse.json({ error: 'Failed to update escalation' }, { status: 500 })
  }
}
