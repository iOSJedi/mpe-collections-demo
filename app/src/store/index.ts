import { configureStore } from '@reduxjs/toolkit'
import { TypedUseSelectorHook, useDispatch, useSelector } from 'react-redux'
import navReducer from './slices/navSlice'
import chatReducer from './slices/chatSlice'
import customerReducer from './slices/customerSlice'
import wholesaleReducer from './slices/wholesaleSlice'
import branchReducer from './slices/branchSlice'
import analyticsReducer from './slices/analyticsSlice'
import dashboardReducer from './slices/dashboardSlice'

export const store = configureStore({
  reducer: {
    nav: navReducer,
    chat: chatReducer,
    customer: customerReducer,
    wholesale: wholesaleReducer,
    branch: branchReducer,
    analytics: analyticsReducer,
    dashboard: dashboardReducer,
  },
})

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch

export const useAppDispatch: () => AppDispatch = useDispatch
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector
