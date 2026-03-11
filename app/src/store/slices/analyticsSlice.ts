import { createSlice, PayloadAction } from '@reduxjs/toolkit'

interface AnalyticsState {
  runningTask: string | null
  lastResults: Record<string, { summary: string; timestamp: string }>
}

const initialState: AnalyticsState = {
  runningTask: null,
  lastResults: {},
}

const analyticsSlice = createSlice({
  name: 'analytics',
  initialState,
  reducers: {
    setRunningTask(state, action: PayloadAction<string | null>) {
      state.runningTask = action.payload
    },
    setTaskResult(state, action: PayloadAction<{ task: string; summary: string }>) {
      state.lastResults[action.payload.task] = {
        summary: action.payload.summary,
        timestamp: new Date().toISOString(),
      }
    },
  },
})

export const { setRunningTask, setTaskResult } = analyticsSlice.actions
export default analyticsSlice.reducer
