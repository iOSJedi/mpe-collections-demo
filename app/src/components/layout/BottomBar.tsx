'use client'

import { useAppDispatch } from '@/store'
import { toggleEmulator } from '@/store/slices/emulatorSlice'

export function BottomBar() {
  const dispatch = useAppDispatch()

  return (
    <footer
      className="h-10 flex items-center justify-between px-4 border-t border-border bg-white shrink-0"
    >
      <span className="text-xs text-muted-foreground">Admin Portal</span>
      <button
        onClick={() => dispatch(toggleEmulator())}
        className="text-xs px-3 py-1 rounded border font-medium transition-colors hover:bg-[#C5A930]/10"
        style={{ borderColor: '#C5A930', color: '#C5A930' }}
      >
        Customer Emulator
      </button>
    </footer>
  )
}
