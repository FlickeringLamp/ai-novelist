import { configureStore } from '@reduxjs/toolkit'
import tabReducer from './file_editor.js'


export const store = configureStore({
  reducer: {
    file_editor: tabReducer
  },
})