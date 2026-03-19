'use client'

import { useState, useEffect } from 'react'
import { Loader2 } from 'lucide-react'
import { apiFetch } from '@/lib/api'
import { PenaltyConfig } from '@/types'
import { cn } from '@/lib/utils'

export function PenaltySettings() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null)

  const [penaltyRatePercent, setPenaltyRatePercent] = useState(2.0)
  const [gracePeriodDays, setGracePeriodDays] = useState(0)
  const [applicationMethod, setApplicationMethod] = useState<'PENALTIES_FIRST' | 'FIFO'>('PENALTIES_FIRST')

  useEffect(() => {
    async function fetchConfig() {
      try {
        const res = await apiFetch('/api/penalty-config')
        if (res.ok) {
          const data: PenaltyConfig = await res.json()
          setPenaltyRatePercent(data.penaltyRatePercent)
          setGracePeriodDays(data.gracePeriodDays)
          setApplicationMethod(data.applicationMethod)
        }
      } catch {
        // Use defaults if fetch fails
      } finally {
        setLoading(false)
      }
    }
    fetchConfig()
  }, [])

  const handleSave = async () => {
    if (saving) return
    setResult(null)
    setSaving(true)
    try {
      const res = await apiFetch('/api/penalty-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ penaltyRatePercent, applicationMethod, gracePeriodDays }),
      })
      if (res.ok) {
        setResult({ ok: true, message: 'Penalty settings saved.' })
      } else {
        const data = await res.json().catch(() => ({}))
        setResult({ ok: false, message: data.error || 'Save failed.' })
      }
    } catch (err) {
      setResult({ ok: false, message: err instanceof Error ? err.message : 'Unknown error' })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-slate-400 text-xs py-2">
        <Loader2 className="w-3 h-3 animate-spin" />
        Loading penalty config…
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Penalty Rate */}
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">
          Penalty Rate (% / month)
        </label>
        <input
          type="number"
          min={0}
          step={0.1}
          value={penaltyRatePercent}
          onChange={e => setPenaltyRatePercent(parseFloat(e.target.value) || 0)}
          className="w-full px-2 py-1.5 text-sm rounded border border-slate-300 bg-white text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#003B1F]"
        />
      </div>

      {/* Grace Period */}
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">
          Grace Period (days)
        </label>
        <input
          type="number"
          min={0}
          step={1}
          value={gracePeriodDays}
          onChange={e => setGracePeriodDays(parseInt(e.target.value) || 0)}
          className="w-full px-2 py-1.5 text-sm rounded border border-slate-300 bg-white text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#003B1F]"
        />
      </div>

      {/* Application Method */}
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-2">
          Application Method
        </label>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setApplicationMethod('PENALTIES_FIRST')}
            className={cn(
              'px-2 py-2 rounded border text-xs text-center transition-colors',
              applicationMethod === 'PENALTIES_FIRST'
                ? 'border-[#003B1F] bg-[#003B1F]/5 text-[#003B1F] font-medium'
                : 'border-slate-200 text-slate-500 hover:border-slate-300'
            )}
          >
            <div className="font-semibold mb-0.5">Penalties First</div>
            <div className="text-[10px] opacity-70 leading-tight">Landlord-friendly</div>
          </button>
          <button
            type="button"
            onClick={() => setApplicationMethod('FIFO')}
            className={cn(
              'px-2 py-2 rounded border text-xs text-center transition-colors',
              applicationMethod === 'FIFO'
                ? 'border-[#003B1F] bg-[#003B1F]/5 text-[#003B1F] font-medium'
                : 'border-slate-200 text-slate-500 hover:border-slate-300'
            )}
          >
            <div className="font-semibold mb-0.5">FIFO / Oldest</div>
            <div className="text-[10px] opacity-70 leading-tight">Payer-friendly</div>
          </button>
        </div>
      </div>

      {/* Save */}
      <button
        onClick={handleSave}
        disabled={saving}
        className="flex items-center gap-2 w-full justify-center px-3 py-2 text-xs font-medium rounded-lg transition-colors disabled:opacity-50"
        style={{ backgroundColor: '#003B1F', color: '#fff' }}
      >
        {saving ? (
          <>
            <Loader2 className="w-3 h-3 animate-spin" />
            Saving…
          </>
        ) : (
          'Save Penalty Config'
        )}
      </button>

      {result && (
        <div
          className={cn(
            'text-xs px-3 py-2 rounded-lg border',
            result.ok
              ? 'bg-green-50 border-green-200 text-green-700'
              : 'bg-red-50 border-red-200 text-red-700'
          )}
        >
          {result.message}
        </div>
      )}
    </div>
  )
}
