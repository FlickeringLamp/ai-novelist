import { configureStore } from '@reduxjs/toolkit'
import launcherReducer from './launcher'
import gitReducer from './git'

export const store = configureStore({
  reducer: {
    launcherSlice: launcherReducer,
    gitSlice: gitReducer,
  },
})

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
