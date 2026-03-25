'use client'

import { useEffect, useState, useCallback } from 'react'
import { apiFetch } from '@/lib/api'
import type { MilestoneTemplate } from '@/types'

const SEGMENT_COLORS = [
  'bg-blue-500',
  'bg-emerald-500',
  'bg-violet-500',
  'bg-amber-500',
  'bg-rose-500',
  'bg-cyan-500',
]

const SEGMENT_TEXT_COLORS = [
  'text-blue-600',
  'text-emerald-600',
  'text-violet-600',
  'text-amber-600',
  'text-rose-600',
  'text-cyan-600',
]

const SEGMENT_BG_LIGHT = [
  'bg-blue-50',
  'bg-emerald-50',
  'bg-violet-50',
  'bg-amber-50',
  'bg-rose-50',
  'bg-cyan-50',
]

interface NewMilestoneRow {
  label: string
  percentage: string
}

export function MilestoneTemplates() {
  const [templates, setTemplates] = useState<MilestoneTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // New template form state
  const [showForm, setShowForm] = useState(false)
  const [formName, setFormName] = useState('')
  const [formRows, setFormRows] = useState<NewMilestoneRow[]>([
    { label: '', percentage: '' },
    { label: '', percentage: '' },
  ])
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const fetchTemplates = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await apiFetch('/api/milestone-templates')
      if (!res.ok) throw new Error('Failed to load templates')
      const data: MilestoneTemplate[] = await res.json()
      setTemplates(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchTemplates()
  }, [fetchTemplates])

  function addRow() {
    setFormRows((prev) => [...prev, { label: '', percentage: '' }])
  }

  function removeRow(index: number) {
    setFormRows((prev) => prev.filter((_, i) => i !== index))
  }

  function updateRow(index: number, field: 'label' | 'percentage', value: string) {
    setFormRows((prev) => prev.map((r, i) => (i === index ? { ...r, [field]: value } : r)))
  }

  function resetForm() {
    setFormName('')
    setFormRows([
      { label: '', percentage: '' },
      { label: '', percentage: '' },
    ])
    setFormError(null)
    setShowForm(false)
  }

  async function handleCreate() {
    setFormError(null)
    if (!formName.trim()) {
      setFormError('Template name is required.')
      return
    }
    const milestones = formRows
      .filter((r) => r.label.trim() && r.percentage.trim())
      .map((r) => ({ label: r.label.trim(), percentage: parseFloat(r.percentage) }))

    if (milestones.length === 0) {
      setFormError('At least one milestone is required.')
      return
    }
    const total = milestones.reduce((s, m) => s + m.percentage, 0)
    if (Math.abs(total - 100) > 0.01) {
      setFormError(`Percentages must sum to 100. Current sum: ${total.toFixed(1)}`)
      return
    }

    setSaving(true)
    try {
      const res = await apiFetch('/api/milestone-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: formName.trim(), milestones }),
      })
      if (res.ok) {
        resetForm()
        fetchTemplates()
      } else {
        const err = await res.json()
        setFormError(err.error ?? 'Failed to create template.')
      }
    } catch {
      setFormError('Network error.')
    } finally {
      setSaving(false)
    }
  }

  const currentPercentageSum = formRows
    .filter((r) => r.percentage.trim())
    .reduce((s, r) => s + (parseFloat(r.percentage) || 0), 0)

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-slate-800">Milestone Templates</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Reusable payment milestone definitions for purchase orders
          </p>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 transition-colors"
        >
          {showForm ? 'Cancel' : '+ New Template'}
        </button>
      </div>

      {/* New template form */}
      {showForm && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 space-y-3">
          <p className="text-sm font-semibold text-blue-800">New Template</p>

          <div>
            <label className="text-xs text-slate-600 font-medium block mb-1">Template Name</label>
            <input
              type="text"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder="e.g. Construction Milestone 4-Stage"
              className="w-full rounded border border-slate-300 bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs text-slate-600 font-medium">Milestones</label>
              <span className={`text-xs font-medium ${Math.abs(currentPercentageSum - 100) < 0.01 ? 'text-green-600' : 'text-slate-400'}`}>
                {currentPercentageSum.toFixed(1)}% / 100%
              </span>
            </div>
            <div className="space-y-1.5">
              {formRows.map((row, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <input
                    type="text"
                    value={row.label}
                    onChange={(e) => updateRow(i, 'label', e.target.value)}
                    placeholder={`Milestone ${i + 1} label`}
                    className="flex-1 rounded border border-slate-300 bg-white px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <input
                    type="number"
                    value={row.percentage}
                    onChange={(e) => updateRow(i, 'percentage', e.target.value)}
                    placeholder="%"
                    min="0"
                    max="100"
                    className="w-16 rounded border border-slate-300 bg-white px-2 py-1 text-xs text-center focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <button
                    onClick={() => removeRow(i)}
                    disabled={formRows.length <= 2}
                    className="text-slate-400 hover:text-red-500 disabled:opacity-30 text-sm leading-none"
                  >
                    &times;
                  </button>
                </div>
              ))}
            </div>
            <button
              onClick={addRow}
              className="mt-1.5 text-xs text-blue-600 hover:text-blue-800 font-medium"
            >
              + Add row
            </button>
          </div>

          {formError && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-2 py-1">
              {formError}
            </p>
          )}

          <div className="flex gap-2 justify-end">
            <button
              onClick={resetForm}
              className="rounded px-3 py-1.5 text-xs font-medium text-slate-600 border border-slate-300 hover:bg-slate-100"
            >
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={saving}
              className="rounded bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Create Template'}
            </button>
          </div>
        </div>
      )}

      {/* Template list */}
      {loading ? (
        <p className="text-sm text-slate-400">Loading templates…</p>
      ) : error ? (
        <p className="text-sm text-red-500">{error}</p>
      ) : templates.length === 0 ? (
        <p className="text-sm text-slate-400">No templates yet. Create one above.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {templates.map((tpl) => (
            <div
              key={tpl.templateId}
              className="rounded-xl border border-slate-200 bg-white p-4 space-y-3"
            >
              <p className="text-sm font-semibold text-slate-800">{tpl.name}</p>

              {/* Percentage bar */}
              <div className="flex h-3 w-full overflow-hidden rounded-full">
                {tpl.milestones.map((m, i) => (
                  <div
                    key={i}
                    className={`${SEGMENT_COLORS[i % SEGMENT_COLORS.length]} h-full`}
                    style={{ width: `${m.percentage}%` }}
                    title={`${m.label}: ${m.percentage}%`}
                  />
                ))}
              </div>

              {/* Milestone labels */}
              <div className="space-y-1">
                {tpl.milestones.map((m, i) => (
                  <div key={i} className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <div
                        className={`h-2 w-2 rounded-full shrink-0 ${SEGMENT_COLORS[i % SEGMENT_COLORS.length]}`}
                      />
                      <span className="text-xs text-slate-700 truncate">{m.label}</span>
                    </div>
                    <span
                      className={`shrink-0 text-xs font-semibold px-1.5 py-0.5 rounded ${SEGMENT_BG_LIGHT[i % SEGMENT_BG_LIGHT.length]} ${SEGMENT_TEXT_COLORS[i % SEGMENT_TEXT_COLORS.length]}`}
                    >
                      {m.percentage}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
