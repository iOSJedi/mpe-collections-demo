import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import { CustomerSummary, CustomerProfile } from '@/types'

interface CustomerState {
  customers: CustomerSummary[]
  selectedCustomer: CustomerProfile | null
  loading: boolean
  lastFetched: number | null
  filters: {
    type: 'all' | 'retail' | 'wholesale' | 'both'
    segment: string
    search: string
  }
}

const initialState: CustomerState = {
  customers: [],
  selectedCustomer: null,
  loading: false,
  lastFetched: null,
  filters: { type: 'all', segment: '', search: '' },
}

const customerSlice = createSlice({
  name: 'customer',
  initialState,
  reducers: {
    setCustomers(state, action: PayloadAction<CustomerSummary[]>) {
      state.customers = action.payload
      state.lastFetched = Date.now()
    },
    setSelectedCustomer(state, action: PayloadAction<CustomerProfile | null>) {
      state.selectedCustomer = action.payload
    },
    setCustomerLoading(state, action: PayloadAction<boolean>) {
      state.loading = action.payload
    },
    setCustomerFilters(state, action: PayloadAction<Partial<CustomerState['filters']>>) {
      state.filters = { ...state.filters, ...action.payload }
    },
  },
})

export const { setCustomers, setSelectedCustomer, setCustomerLoading, setCustomerFilters } = customerSlice.actions
export default customerSlice.reducer
