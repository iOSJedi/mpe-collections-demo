import { configureStore } from '@reduxjs/toolkit'
import { TypedUseSelectorHook, useDispatch, useSelector } from 'react-redux'
import navReducer from './slices/navSlice'
import chatReducer from './slices/chatSlice'
import dashboardReducer from './slices/dashboardSlice'
import receivableReducer from './slices/receivableSlice'
import payableReducer from './slices/payableSlice'
import collectionsReducer from './slices/collectionsSlice'
import emulatorReducer from './slices/emulatorSlice'

export const store = configureStore({
  reducer: {
    nav: navReducer,
    chat: chatReducer,
    dashboard: dashboardReducer,
    receivable: receivableReducer,
    payable: payableReducer,
    collections: collectionsReducer,
    emulator: emulatorReducer,
  },
})

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
export const useAppDispatch: () => AppDispatch = useDispatch
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector
