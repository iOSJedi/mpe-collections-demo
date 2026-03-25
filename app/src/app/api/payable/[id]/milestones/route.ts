import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth-middleware'
import { db } from '@/db'
import { milestoneTemplates, poMilestones, purchaseOrders } from '@/db/schema'
import { eq, sql } from 'drizzle-orm'
import type { POMilestone } from '@/types'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await verifyToken(request)
  if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })

  try {
    const { id } = await params
    const poId = parseInt(id, 10)
    if (isNaN(poId)) {
      return NextResponse.json({ error: 'Invalid PO ID' }, { status: 400 })
    }

    const result = await db.execute(
      sql`SELECT * FROM po_milestones_col WHERE po_id = ${poId} ORDER BY sort_order ASC`
    )

    const milestones: POMilestone[] = result.map((row) => ({
      milestoneId: Number(row.milestone_id),
      poId: Number(row.po_id),
      label: String(row.label),
      percentage: Number(row.percentage),
      amount: Number(row.amount),
      status: String(row.status) as 'PENDING' | 'COMPLETED' | 'PAID',
      completedAt: row.completed_at ? String(row.completed_at) : null,
      paidAt: row.paid_at ? String(row.paid_at) : null,
      paymentReference: row.payment_reference ? String(row.payment_reference) : null,
      sortOrder: Number(row.sort_order),
    }))

    return NextResponse.json(milestones)
  } catch (error) {
    console.error('Failed to fetch PO milestones:', error)
    return NextResponse.json({ error: 'Failed to fetch PO milestones' }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await verifyToken(request)
  if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })

  try {
    const { id } = await params
    const poId = parseInt(id, 10)
    if (isNaN(poId)) {
      return NextResponse.json({ error: 'Invalid PO ID' }, { status: 400 })
    }

    const body = await request.json()
    const { templateId, milestones: customMilestones } = body as {
      templateId?: number
      milestones?: { label: string; percentage: number }[]
    }

    let milestoneDefs: { label: string; percentage: number }[]

    if (templateId !== undefined) {
      const [template] = await db
        .select()
        .from(milestoneTemplates)
        .where(eq(milestoneTemplates.templateId, templateId))

      if (!template) {
        return NextResponse.json({ error: 'Template not found' }, { status: 404 })
      }
      milestoneDefs = template.milestones as { label: string; percentage: number }[]
    } else if (Array.isArray(customMilestones) && customMilestones.length > 0) {
      milestoneDefs = customMilestones
    } else {
      return NextResponse.json(
        { error: 'Provide templateId or milestones array' },
        { status: 400 }
      )
    }

    const total = milestoneDefs.reduce((sum, m) => sum + m.percentage, 0)
    if (Math.abs(total - 100) > 0.01) {
      return NextResponse.json(
        { error: `Milestone percentages must sum to exactly 100 (got ${total})` },
        { status: 400 }
      )
    }

    const [po] = await db
      .select({ totalAmount: purchaseOrders.totalAmount })
      .from(purchaseOrders)
      .where(eq(purchaseOrders.poId, poId))

    if (!po) {
      return NextResponse.json({ error: 'Purchase order not found' }, { status: 404 })
    }

    const totalAmount = Number(po.totalAmount)

    const rows = milestoneDefs.map((m, i) => ({
      poId,
      label: m.label,
      percentage: String(m.percentage),
      amount: String((totalAmount * m.percentage) / 100),
      sortOrder: i,
    }))

    const inserted = await db.insert(poMilestones).values(rows).returning()

    const result: POMilestone[] = inserted.map((row) => ({
      milestoneId: row.milestoneId,
      poId: row.poId,
      label: row.label,
      percentage: Number(row.percentage),
      amount: Number(row.amount),
      status: row.status as 'PENDING' | 'COMPLETED' | 'PAID',
      completedAt: row.completedAt ? row.completedAt.toISOString() : null,
      paidAt: row.paidAt ? row.paidAt.toISOString() : null,
      paymentReference: row.paymentReference ?? null,
      sortOrder: row.sortOrder,
    }))

    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    console.error('Failed to assign milestones to PO:', error)
    return NextResponse.json({ error: 'Failed to assign milestones to PO' }, { status: 500 })
  }
}
