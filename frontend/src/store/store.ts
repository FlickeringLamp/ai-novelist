import { configureStore } from '@reduxjs/toolkit'
import tabReducer from './editor'
import fileReducer from './file'
import providerReducer from './provider'

export const store = configureStore({
  reducer: {
    tabSlice: tabReducer,
    fileSlice: fileReducer,
    providerSlice: providerReducer
  },
})

export type RootState = ReturnType<typeof store.getState>
