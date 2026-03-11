import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import { EmulatorState } from '@/types'

const initialState: EmulatorState = {
  isOpen: false,
  selectedCustomerId: null,
  activeTab: 'invoices',
  selectedInvoiceId: null,
}

const emulatorSlice = createSlice({
  name: 'emulator',
  initialState,
  reducers: {
    toggleEmulator(state) { state.isOpen = !state.isOpen },
    openEmulator(state) { state.isOpen = true },
    closeEmulator(state) { state.isOpen = false },
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
  },
})

export const { toggleEmulator, openEmulator, closeEmulator, setSelectedCustomer, setActiveTab, setSelectedInvoice } = emulatorSlice.actions
export default emulatorSlice.reducer
