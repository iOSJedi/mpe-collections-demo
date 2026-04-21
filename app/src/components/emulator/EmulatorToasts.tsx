'use client'
import { useSelector } from 'react-redux'
import type { RootState } from '@/store'

export function EmulatorToasts() {
  const toasts = useSelector((s: RootState) => s.emulator?.toasts ?? [])
  return (
    <div className="fixed bottom-4 right-4 z-[100] space-y-2 pointer-events-none max-w-sm">
      {toasts.map(t => (
        <div
          key={t.id}
          className="bg-slate-900 text-white text-sm px-4 py-3 rounded-lg shadow-lg pointer-events-auto animate-in fade-in slide-in-from-bottom-2"
        >
          {t.text}
        </div>
      ))}
    </div>
  )
}
