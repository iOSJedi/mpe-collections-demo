import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import { NavSpace, NavPage } from '@/types'

interface NavState {
  activeSpace: NavSpace
  activePage: NavPage
}

const initialState: NavState = {
  activeSpace: 'overview',
  activePage: 'overview',
}

const navSlice = createSlice({
  name: 'nav',
  initialState,
  reducers: {
    setActiveSpace(state, action: PayloadAction<NavSpace>) {
      state.activeSpace = action.payload
    },
    setActivePage(state, action: PayloadAction<NavPage>) {
      state.activePage = action.payload
    },
    navigate(state, action: PayloadAction<{ space: NavSpace; page: NavPage }>) {
      state.activeSpace = action.payload.space
      state.activePage = action.payload.page
    },
  },
})

export const { setActiveSpace, setActivePage, navigate } = navSlice.actions
export default navSlice.reducer
