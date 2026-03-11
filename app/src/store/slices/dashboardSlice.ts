import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import { apiFetch } from '@/lib/api'
import { OverviewKPIs, InsightCard } from '@/types'

interface DashboardState {
  kpis: OverviewKPIs | null
  insights: InsightCard[]
  loading: boolean
  error: string | null
}

const initialState: DashboardState = {
  kpis: null,
  insights: [],
  loading: false,
  error: null,
}

export const fetchKPIs = createAsyncThunk(
  'dashboard/fetchKPIs',
  async (_, { rejectWithValue }) => {
    const res = await apiFetch('/api/kpi')
    if (!res.ok) return rejectWithValue('Failed to fetch KPIs')
    return res.json() as Promise<OverviewKPIs>
  }
)

export const fetchInsights = createAsyncThunk(
  'dashboard/fetchInsights',
  async (_, { rejectWithValue }) => {
    const res = await apiFetch('/api/insights')
    if (!res.ok) return rejectWithValue('Failed to fetch insights')
    const data = await res.json()
    // API returns { insights: InsightCard[] }
    return (data.insights ?? data) as InsightCard[]
  }
)

const dashboardSlice = createSlice({
  name: 'dashboard',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    // fetchKPIs
    builder.addCase(fetchKPIs.pending, (state) => {
      state.loading = true
      state.error = null
    })
    builder.addCase(fetchKPIs.fulfilled, (state, action) => {
      state.loading = false
      state.kpis = action.payload
    })
    builder.addCase(fetchKPIs.rejected, (state, action) => {
      state.loading = false
      state.error = action.payload as string
    })

    // fetchInsights
    builder.addCase(fetchInsights.pending, (state) => {
      state.loading = true
      state.error = null
    })
    builder.addCase(fetchInsights.fulfilled, (state, action) => {
      state.loading = false
      state.insights = action.payload
    })
    builder.addCase(fetchInsights.rejected, (state, action) => {
      state.loading = false
      state.error = action.payload as string
    })
  },
})

export default dashboardSlice.reducer
