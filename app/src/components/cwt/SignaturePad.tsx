'use client'
import { useRef, useState, useEffect } from 'react'

export function SignaturePad({ onChange }: { onChange: (dataUrl: string | null) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [drawing, setDrawing] = useState(false)
  const [hasInk, setHasInk] = useState(false)

  useEffect(() => {
    const c = canvasRef.current!
    const ctx = c.getContext('2d')!
    ctx.lineWidth = 2
    ctx.strokeStyle = '#0b2545'
  }, [])

  const pos = (e: React.PointerEvent) => {
    const c = canvasRef.current!
    const r = c.getBoundingClientRect()
    return { x: ((e.clientX - r.left) / r.width) * c.width, y: ((e.clientY - r.top) / r.height) * c.height }
  }
  const start = (e: React.PointerEvent) => { setDrawing(true); const {x,y} = pos(e); const ctx = canvasRef.current!.getContext('2d')!; ctx.beginPath(); ctx.moveTo(x,y) }
  const move = (e: React.PointerEvent) => {
    if (!drawing) return
    const {x,y} = pos(e); const ctx = canvasRef.current!.getContext('2d')!
    ctx.lineTo(x,y); ctx.stroke(); setHasInk(true)
  }
  const end = () => {
    setDrawing(false)
    if (!hasInk) return
    onChange(canvasRef.current!.toDataURL('image/png'))
  }
  const clear = () => {
    const c = canvasRef.current!; c.getContext('2d')!.clearRect(0,0,c.width,c.height); setHasInk(false); onChange(null)
  }

  return (
    <div className="space-y-2">
      <canvas ref={canvasRef} width={480} height={140}
        className="w-full border border-slate-300 rounded bg-white cursor-crosshair"
        onPointerDown={start} onPointerMove={move} onPointerUp={end} onPointerLeave={end} />
      <button type="button" onClick={clear} className="text-sm text-slate-500 hover:text-slate-900">Clear</button>
    </div>
  )
}
