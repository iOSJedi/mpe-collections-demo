import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import { EmulatorState, EmulatorMode } from '@/types'

const initialState: EmulatorState = {
  isOpen: false,
  mode: 'payer',
  selectedCustomerId: null,
  activeTab: 'invoices',
  selectedInvoiceId: null,
  selectedSupplierId: null,
  selectedPoId: null,
  toasts: [],
}

const emulatorSlice = createSlice({
  name: 'emulator',
  initialState,
  reducers: {
    toggleEmulator(state) { state.isOpen = !state.isOpen },
    openEmulator(state) { state.isOpen = true },
    closeEmulator(state) { state.isOpen = false },
    setEmulatorMode(state, action: PayloadAction<EmulatorMode>) {
      state.mode = action.payload
    },
    setSelectedCustomer(state, action: PayloadAction<number | null>) {
      state.selectedCustomerId = action.payload
      state.selectedInvoiceId = null
    },
    setActiveTab(state, action: PayloadAction<EmulatorState['activeTab']>) {
      state.activeTab = action.payload
    },
    setSelectedInvoice(state, action: PayloadAction<number | null>) {
      state.selectedInvoiceId = action.payload
    },
    setSelectedSupplier(state, action: PayloadAction<number | null>) {
      state.selectedSupplierId = action.payload
      state.selectedPoId = null
    },
    setSelectedPo(state, action: PayloadAction<number | null>) {
      state.selectedPoId = action.payload
    },
    pushToast(state, action: PayloadAction<{ text: string }>) {
      state.toasts.push({ id: Date.now() + Math.random(), text: action.payload.text })
    },
    clearToasts(state) {
      state.toasts = []
    },
  },
})

export const {
  toggleEmulator, openEmulator, closeEmulator, setEmulatorMode,
  setSelectedCustomer, setActiveTab, setSelectedInvoice,
  setSelectedSupplier, setSelectedPo,
  pushToast, clearToasts,
} = emulatorSlice.actions
export default emulatorSlice.reducer
