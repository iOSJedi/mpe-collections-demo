'use client'
import { useEffect, useRef, useState } from 'react'
import type { FieldCoord } from '@/lib/cwt/pdf-coords'

// PDF is 612×936 pt. Background PNG is rendered at 2.5× = 1530×2340 px.
const PDF_W = 612
const PDF_H = 936
const BG_SCALE = 2.5  // PNG native scale

// Sample preview values drawn inside each draggable marker
const SAMPLES: Record<string, string> = {
  periodFromMM: '04', periodFromDD: '30', periodFromYYYY: '2026',
  periodToMM: '05', periodToDD: '31', periodToYYYY: '2026',
  payeeTin1: '000', payeeTin2: '111', payeeTin3: '222', payeeTin4: '000',
  payeeName: 'AYALA LAND, INC.',
  payeeAddress: 'Tower One, Ayala Triangle, Makati City',
  payeeZip: '1226',
  payorTin1: '640', payorTin2: '503', payorTin3: '867', payorTin4: '000',
  payorName: 'APPLE PHILIPPINES',
  payorAddress: '30th St cor 11th Ave, BGC, Taguig',
  payorZip: '1634',
  rowLabel: 'Rentals of Real Property',
  rowAtc: 'WC100',
  rowGross: '2,455,942.00',
  rowTotal: '2,455,942.00',
  rowTaxWithheld: '122,797.10',
  totalsGross: '2,455,942.00',
  totalsTax: '122,797.10',
  signatureImg: '[signature image]',
  signatoryName: 'Juan Dela Cruz — Authorized Signatory',
  signatoryFor: 'for Apple Philippines',
  stamp: 'Issued automatically by Ayala Land Inc…',
}

export function OverlayEditor({ initialCoords }: { initialCoords: Record<string, FieldCoord> }) {
  const [coords, setCoords] = useState<Record<string, FieldCoord>>(initialCoords)
  const [dragging, setDragging] = useState<{ key: string; dx: number; dy: number } | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [zoom, setZoom] = useState(1)       // CSS scale applied to the image + overlay
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const stageRef = useRef<HTMLDivElement>(null)

  const displayScale = BG_SCALE * zoom  // px per PDF point
  const width = PDF_W * displayScale
  const height = PDF_H * displayScale

  // Convert between coordinate systems
  const toCss = (c: FieldCoord) => ({ left: c.x * displayScale, top: c.y * displayScale })

  const onPointerDown = (e: React.PointerEvent, key: string) => {
    e.preventDefault(); e.stopPropagation()
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    setSelected(key)
    setDragging({ key, dx: e.clientX - rect.left, dy: e.clientY - rect.top })
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging || !stageRef.current) return
    const stage = stageRef.current.getBoundingClientRect()
    const cssX = e.clientX - stage.left - dragging.dx
    const cssY = e.clientY - stage.top - dragging.dy
    const pdfX = cssX / displayScale
    const pdfY = cssY / displayScale
    setCoords(prev => ({ ...prev, [dragging.key]: { ...prev[dragging.key], x: round(pdfX), y: round(pdfY) } }))
  }
  const onPointerUp = () => setDragging(null)

  const round = (n: number) => Math.round(n * 10) / 10

  const nudge = (key: string, dx: number, dy: number) => {
    setCoords(prev => ({ ...prev, [key]: { ...prev[key], x: round(prev[key].x + dx), y: round(prev[key].y + dy) } }))
  }
  const setField = (key: string, field: keyof FieldCoord, value: number | boolean | undefined) => {
    setCoords(prev => ({ ...prev, [key]: { ...prev[key], [field]: value } }))
  }

  const save = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/tools/save-coords', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ coords }),
      })
      const out = await res.json()
      if (!res.ok) throw new Error(out.error ?? 'save failed')
      setToast(`Saved ${out.fields} fields to DB. Preview now reflects these coords.`)
    } catch (e: any) {
      setToast('Error: ' + e.message)
    } finally {
      setSaving(false)
      setTimeout(() => setToast(null), 4000)
    }
  }

  const reset = () => setCoords(initialCoords)
  const openPreview = () => window.open('/api/tools/preview-2307', '_blank')

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!selected) return
      const step = e.shiftKey ? 5 : 1
      if (e.key === 'ArrowUp')    { e.preventDefault(); nudge(selected, 0, -step) }
      if (e.key === 'ArrowDown')  { e.preventDefault(); nudge(selected, 0, +step) }
      if (e.key === 'ArrowLeft')  { e.preventDefault(); nudge(selected, -step, 0) }
      if (e.key === 'ArrowRight') { e.preventDefault(); nudge(selected, +step, 0) }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [selected])

  const sel = selected ? coords[selected] : null

  return (
    <div className="h-screen flex bg-slate-100">
      {/* LEFT — scrollable stage */}
      <div className="flex-1 overflow-auto p-6" onPointerMove={onPointerMove} onPointerUp={onPointerUp}>
        <div
          ref={stageRef}
          className="relative mx-auto shadow-xl"
          style={{ width, height, backgroundImage: `url(/forms/BIR-2307-bg.png)`, backgroundSize: `${width}px ${height}px` }}
          onClick={(e) => { if (e.target === e.currentTarget) setSelected(null) }}
        >
          {Object.entries(coords).map(([key, c]) => {
            const { left, top } = toCss(c)
            const isSel = selected === key
            const sample = SAMPLES[key] ?? c.label
            const pitched = (c.charPitch ?? 0) > 0

            const baseStyle: React.CSSProperties = {
              position: 'absolute', left, top,
              transform: 'translateY(-100%)',
              fontSize: (c.size ?? 10) * displayScale,
              fontFamily: c.monospace ? '"Courier New", Courier, monospace' : 'Helvetica, Arial, sans-serif',
              fontWeight: c.bold !== false ? 700 : 400,
              color: '#0052cc',
              background: isSel ? 'rgba(0,82,204,0.25)' : 'rgba(0,82,204,0.08)',
              border: `1px ${isSel ? 'solid' : 'dashed'} rgba(0,82,204,0.8)`,
              cursor: dragging?.key === key ? 'grabbing' : 'grab',
              whiteSpace: 'nowrap',
              userSelect: 'none',
              padding: pitched ? 0 : '1px 4px',
            }

            if (pitched) {
              // Each character gets its own cell at exactly charPitch px
              const pxPitch = (c.charPitch ?? 0) * displayScale
              return (
                <div key={key} onPointerDown={(e) => onPointerDown(e, key)}
                     style={{ ...baseStyle, display: 'flex', alignItems: 'flex-end' }}>
                  {sample.split('').map((ch, i) => (
                    <span key={i} style={{
                      display: 'inline-block',
                      width: pxPitch,
                      textAlign: 'center',
                      lineHeight: 1,
                    }}>{ch}</span>
                  ))}
                </div>
              )
            }

            return (
              <div key={key} onPointerDown={(e) => onPointerDown(e, key)} style={baseStyle}>
                {sample}
              </div>
            )
          })}
        </div>
      </div>

      {/* RIGHT — control panel */}
      <aside className="w-80 border-l bg-white flex flex-col">
        <div className="p-4 border-b">
          <h1 className="text-lg font-semibold">BIR 2307 Overlay Editor</h1>
          <p className="text-xs text-slate-500 mt-1">Drag markers to position. Arrow keys to nudge (1pt), Shift+Arrow (5pt).</p>
        </div>

        <div className="p-4 border-b space-y-2">
          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-500 w-10">Zoom</label>
            <input type="range" min={0.3} max={1.2} step={0.05} value={zoom}
                   onChange={e => setZoom(Number(e.target.value))} className="flex-1" />
            <span className="text-xs font-mono w-10 text-right">{(zoom * 100).toFixed(0)}%</span>
          </div>
          <button onClick={openPreview} className="w-full bg-slate-900 text-white text-sm rounded px-3 py-2 hover:bg-slate-700">
            Open PDF preview (saved coords)
          </button>
          <button onClick={save} disabled={saving}
                  className="w-full bg-blue-600 text-white text-sm rounded px-3 py-2 hover:bg-blue-700 disabled:bg-slate-300">
            {saving ? 'Saving…' : 'Save coords → database'}
          </button>
          <button onClick={reset} className="w-full bg-slate-100 text-slate-700 text-sm rounded px-3 py-2 hover:bg-slate-200">
            Reset to last saved
          </button>
        </div>

        {sel && selected && (
          <div className="p-4 border-b space-y-3">
            <div>
              <div className="text-xs uppercase tracking-wider text-slate-500">{sel.label}</div>
              <div className="text-xs font-mono text-slate-400">{selected}</div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <label className="text-xs">
                <div className="text-slate-500">x (pt)</div>
                <input type="number" step={0.5} value={sel.x}
                       onChange={e => setField(selected, 'x', Number(e.target.value))}
                       className="w-full border rounded px-2 py-1 text-sm font-mono" />
              </label>
              <label className="text-xs">
                <div className="text-slate-500">y (pt, top)</div>
                <input type="number" step={0.5} value={sel.y}
                       onChange={e => setField(selected, 'y', Number(e.target.value))}
                       className="w-full border rounded px-2 py-1 text-sm font-mono" />
              </label>
              <label className="text-xs">
                <div className="text-slate-500">size</div>
                <input type="number" step={0.5} value={sel.size ?? 10}
                       onChange={e => setField(selected, 'size', Number(e.target.value))}
                       className="w-full border rounded px-2 py-1 text-sm font-mono" />
              </label>
              <label className="text-xs">
                <div className="text-slate-500 flex items-center justify-between">
                  <span>char pitch (pt)</span>
                  <span className="text-[10px] text-slate-400">0 = off</span>
                </div>
                <input type="number" step={0.5} min={0} value={sel.charPitch ?? 0}
                       onChange={e => setField(selected, 'charPitch', Number(e.target.value) || undefined)}
                       className="w-full border rounded px-2 py-1 text-sm font-mono" />
              </label>
              <label className="text-xs flex items-center gap-2 mt-4">
                <input type="checkbox" checked={sel.bold !== false}
                       onChange={e => setField(selected, 'bold', e.target.checked ? undefined : false)} />
                <span>Bold</span>
              </label>
              <label className="text-xs flex items-center gap-2 mt-4">
                <input type="checkbox" checked={sel.monospace === true}
                       onChange={e => setField(selected, 'monospace', e.target.checked ? true : undefined)} />
                <span>Monospace (Courier)</span>
              </label>
            </div>
            <div className="mt-2 text-[10px] text-slate-500 leading-tight">
              <strong>Tip:</strong> for TIN / date / ATC cells, enable <em>Monospace</em> + set <em>char pitch</em> to the cell width. Each char gets centered inside its cell automatically. Arrow keys nudge x/y.
            </div>
          </div>
        )}

        <div className="flex-1 overflow-auto">
          <div className="p-2 text-xs uppercase tracking-wider text-slate-500 border-b">Fields ({Object.keys(coords).length})</div>
          {Object.entries(coords).map(([key, c]) => (
            <button key={key} onClick={() => setSelected(key)}
                    className={`w-full text-left px-4 py-2 text-sm border-b hover:bg-slate-50 ${selected === key ? 'bg-blue-50 border-l-2 border-l-blue-600' : ''}`}>
              <div className="font-medium">{c.label}</div>
              <div className="text-xs text-slate-500 font-mono">
                x={c.x} · y={c.y} · {c.size ?? 10}pt{c.charPitch ? ` · pitch ${c.charPitch}` : ''}
              </div>
            </button>
          ))}
        </div>

        {toast && (
          <div className="absolute bottom-6 left-6 bg-slate-900 text-white text-sm px-4 py-2 rounded shadow-lg">
            {toast}
          </div>
        )}
      </aside>
    </div>
  )
}
