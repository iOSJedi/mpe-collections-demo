import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import { ChatMessage, ChartConfig } from '@/types'

interface ChatState {
  messages: ChatMessage[]
  isLoading: boolean
  currentChart: ChartConfig | null
  followUpSuggestions: string[]
}

const initialState: ChatState = {
  messages: [],
  isLoading: false,
  currentChart: null,
  followUpSuggestions: [],
}

const chatSlice = createSlice({
  name: 'chat',
  initialState,
  reducers: {
    addMessage(state, action: PayloadAction<ChatMessage>) {
      state.messages.push(action.payload)
    },
    setLoading(state, action: PayloadAction<boolean>) {
      state.isLoading = action.payload
    },
    setCurrentChart(state, action: PayloadAction<ChartConfig | null>) {
      state.currentChart = action.payload
    },
    setFollowUpSuggestions(state, action: PayloadAction<string[]>) {
      state.followUpSuggestions = action.payload
    },
    clearChat(state) {
      state.messages = []
      state.currentChart = null
      state.followUpSuggestions = []
    },
  },
})

export const { addMessage, setLoading, setCurrentChart, setFollowUpSuggestions, clearChat } = chatSlice.actions
export default chatSlice.reducer
