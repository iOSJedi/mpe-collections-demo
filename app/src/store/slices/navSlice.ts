import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import { NavView } from '@/types'

interface NavState {
  activeView: NavView
  sidebarCollapsed: boolean
}

const initialState: NavState = {
  activeView: 'dashboard',
  sidebarCollapsed: false,
}

const navSlice = createSlice({
  name: 'nav',
  initialState,
  reducers: {
    setActiveView(state, action: PayloadAction<NavView>) {
      state.activeView = action.payload
    },
    toggleSidebar(state) {
      state.sidebarCollapsed = !state.sidebarCollapsed
    },
  },
})

export const { setActiveView, toggleSidebar } = navSlice.actions
export default navSlice.reducer
