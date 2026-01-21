import { configureStore } from '@reduxjs/toolkit'
import tabReducer from './file_editor.js'
import fileReducer from './file.js'


export const store = configureStore({
  reducer: {
    file_editor: tabReducer,
    file: fileReducer
  },
})
