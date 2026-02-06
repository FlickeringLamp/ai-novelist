import { configureStore } from '@reduxjs/toolkit'
import tabReducer from './editor'
import fileReducer from './file'
import providerReducer from './provider'
import knowledgeReducer from './knowledge'
import modeReducer from './mode'

export const store = configureStore({
  reducer: {
    tabSlice: tabReducer,
    fileSlice: fileReducer,
    providerSlice: providerReducer,
    knowledgeSlice: knowledgeReducer,
    modeSlice: modeReducer
  },
})

export type RootState = ReturnType<typeof store.getState>
