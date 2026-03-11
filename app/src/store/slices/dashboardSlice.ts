import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import type { InsightCard } from '@/types'

interface KPIData {
  revenue: { this_month: number; last_month: number; change_pct: number }
  active_customers: { total: number; retail: number; wholesale: number }
  wholesale_credit: { outstanding: number; overdue_pct: number }
  top_branch: { branch_id: string | null; branch_name: string | null; revenue: number }
}

interface DashboardState {
  kpi: KPIData | null
  insights: InsightCard[]
  loading: boolean
  error: string | null
  lastFetched: number | null
}

const initialState: DashboardState = {
  kpi: null,
  insights: [],
  loading: false,
  error: null,
  lastFetched: null,
}

const dashboardSlice = createSlice({
  name: 'dashboard',
  initialState,
  reducers: {
    setDashboardData(state, action: PayloadAction<{ kpi: KPIData; insights: InsightCard[] }>) {
      state.kpi = action.payload.kpi
      state.insights = action.payload.insights
      state.lastFetched = Date.now()
      state.error = null
    },
    setDashboardLoading(state, action: PayloadAction<boolean>) {
      state.loading = action.payload
    },
    setDashboardError(state, action: PayloadAction<string | null>) {
      state.error = action.payload
    },
  },
})

export const { setDashboardData, setDashboardLoading, setDashboardError } = dashboardSlice.actions
export default dashboardSlice.reducer
