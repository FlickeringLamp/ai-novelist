import { configureStore } from '@reduxjs/toolkit'
import tabReducer from './editor.ts'
import fileReducer from './file.js'


export const store = configureStore({
  reducer: {
    tabSlice: tabReducer,
    fileSlice: fileReducer
  },
})
