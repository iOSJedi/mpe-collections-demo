import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import { BranchData } from '@/types'

interface BranchState {
  branches: BranchData[]
  loading: boolean
  lastFetched: number | null
  selectedMetric: 'revenue' | 'transactions' | 'basket_size'
  dateRange: { start: string; end: string }
}

const initialState: BranchState = {
  branches: [],
  loading: false,
  lastFetched: null,
  selectedMetric: 'revenue',
  dateRange: { start: '', end: '' },
}

const branchSlice = createSlice({
  name: 'branch',
  initialState,
  reducers: {
    setBranches(state, action: PayloadAction<BranchData[]>) {
      state.branches = action.payload
      state.lastFetched = Date.now()
    },
    setBranchLoading(state, action: PayloadAction<boolean>) {
      state.loading = action.payload
    },
    setSelectedMetric(state, action: PayloadAction<BranchState['selectedMetric']>) {
      state.selectedMetric = action.payload
    },
    setDateRange(state, action: PayloadAction<{ start: string; end: string }>) {
      state.dateRange = action.payload
    },
  },
})

export const { setBranches, setBranchLoading, setSelectedMetric, setDateRange } = branchSlice.actions
export default branchSlice.reducer
