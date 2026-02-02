import { configureStore } from '@reduxjs/toolkit'
import tabReducer from './editor'
import fileReducer from './file'
import providerReducer from './provider'
import knowledgeReducer from './knowledge'

export const store = configureStore({
  reducer: {
    tabSlice: tabReducer,
    fileSlice: fileReducer,
    providerSlice: providerReducer,
    knowledgeSlice: knowledgeReducer
  },
})

export type RootState = ReturnType<typeof store.getState>
