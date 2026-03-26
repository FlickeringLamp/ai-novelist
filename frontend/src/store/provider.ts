import { createSlice, type Draft, type PayloadAction } from '@reduxjs/toolkit';
import type { ProviderData, ProviderState } from '../types/store';

// ProviderData, ProviderState 类型定义已迁移到 types/store.ts

const initialState: ProviderState = {
  allProvidersData: {},
  selectedProviderId: "deepseek",
  selectedModelId: null,
};

export const providerSlice = createSlice({
  name: 'providerSlice',
  initialState,
  reducers: {
    setAllProvidersData: (
      state: Draft<ProviderState>,
      action: PayloadAction<{ [key: string]: ProviderData }>
    ) => {
      state.allProvidersData = action.payload;
    },
    setSelectedProviderId: (
      state: Draft<ProviderState>,
      action: PayloadAction<string | null>
    ) => {
      state.selectedProviderId = action.payload;
    },
    setSelectedModelId: (
      state: Draft<ProviderState>,
      action: PayloadAction<string | null>
    ) => {
      state.selectedModelId = action.payload;
    }
  }
});

export const {
  setAllProvidersData,
  setSelectedProviderId,
  setSelectedModelId,
} = providerSlice.actions;

export default providerSlice.reducer;
