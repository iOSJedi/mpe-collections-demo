import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth-middleware'
import { db } from '@/db'
import { milestoneTemplates } from '@/db/schema'
import { sql } from 'drizzle-orm'
import type { MilestoneTemplate } from '@/types'

export const GET = withAuth(async (_request: NextRequest) => {
  try {
    const result = await db.execute(sql.raw('SELECT * FROM milestone_templates_col ORDER BY template_id ASC'))

    const templates: MilestoneTemplate[] = result.map((row) => ({
      templateId: Number(row.template_id),
      name: String(row.name),
      milestones: (row.milestones as { label: string; percentage: number }[]),
    }))

    return NextResponse.json(templates)
  } catch (error) {
    console.error('Failed to fetch milestone templates:', error)
    return NextResponse.json({ error: 'Failed to fetch milestone templates' }, { status: 500 })
  }
})

export const POST = withAuth(async (request: NextRequest) => {
  try {
    const body = await request.json()
    const { name, milestones } = body as {
      name: string
      milestones: { label: string; percentage: number }[]
    }

    if (!name || !Array.isArray(milestones) || milestones.length === 0) {
      return NextResponse.json({ error: 'name and milestones are required' }, { status: 400 })
    }

    const total = milestones.reduce((sum, m) => sum + m.percentage, 0)
    if (Math.abs(total - 100) > 0.01) {
      return NextResponse.json(
        { error: `Milestone percentages must sum to exactly 100 (got ${total})` },
        { status: 400 }
      )
    }

    const [inserted] = await db
      .insert(milestoneTemplates)
      .values({ name, milestones })
      .returning()

    const template: MilestoneTemplate = {
      templateId: inserted.templateId,
      name: inserted.name,
      milestones: inserted.milestones as { label: string; percentage: number }[],
    }

    return NextResponse.json(template, { status: 201 })
  } catch (error) {
    console.error('Failed to create milestone template:', error)
    return NextResponse.json({ error: 'Failed to create milestone template' }, { status: 500 })
  }
})
