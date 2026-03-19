'use client'

import { useAppDispatch, useAppSelector } from '@/store'
import { setEmulatorMode } from '@/store/slices/emulatorSlice'
import type { EmulatorMode } from '@/types'

const MODES: { id: EmulatorMode; label: string }[] = [
  { id: 'payer', label: 'Payer' },
  { id: 'supplier', label: 'Supplier' },
]

export function EmulatorModeSwitcher() {
  const dispatch = useAppDispatch()
  const mode = useAppSelector((s) => s.emulator.mode)

  return (
    <div className="flex border-b border-border shrink-0 bg-gray-50">
      {MODES.map((m) => (
        <button
          key={m.id}
          onClick={() => dispatch(setEmulatorMode(m.id))}
          className={`
            flex-1 py-2 text-xs font-semibold transition-colors
            ${mode === m.id
              ? 'text-white'
              : 'text-muted-foreground hover:text-foreground bg-gray-50'
            }
          `}
          style={mode === m.id ? { backgroundColor: '#C5A930' } : {}}
        >
          {m.label}
        </button>
      ))}
    </div>
  )
}
