import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import { WholesaleBuyer } from '@/types'

interface WholesaleState {
  buyers: WholesaleBuyer[]
  loading: boolean
  lastFetched: number | null
  filters: {
    branch: string
    riskLevel: string
    sortBy: string
  }
}

const initialState: WholesaleState = {
  buyers: [],
  loading: false,
  lastFetched: null,
  filters: { branch: 'all', riskLevel: 'all', sortBy: 'risk_score' },
}

const wholesaleSlice = createSlice({
  name: 'wholesale',
  initialState,
  reducers: {
    setBuyers(state, action: PayloadAction<WholesaleBuyer[]>) {
      state.buyers = action.payload
      state.lastFetched = Date.now()
    },
    setWholesaleLoading(state, action: PayloadAction<boolean>) {
      state.loading = action.payload
    },
    setWholesaleFilters(state, action: PayloadAction<Partial<WholesaleState['filters']>>) {
      state.filters = { ...state.filters, ...action.payload }
    },
  },
})

export const { setBuyers, setWholesaleLoading, setWholesaleFilters } = wholesaleSlice.actions
export default wholesaleSlice.reducer
