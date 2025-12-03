import { configureStore } from '@reduxjs/toolkit';
import novelReducer from './slices/novelSlice';

export const store = configureStore({
  reducer: {
    novel: novelReducer,
  },
});