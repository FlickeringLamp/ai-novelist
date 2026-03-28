import { createSlice, type Draft, type PayloadAction } from '@reduxjs/toolkit';
import type { ModeData, ModeState } from '../types/store';

// ModeData, ModeState 类型定义已迁移到 types/store.ts

const initialState: ModeState = {
  allModesData: {},
  selectedModeId: null,
  availableTools: {},
};

export const modeSlice = createSlice({
  name: 'modeSlice',
  initialState,
  reducers: {
    setAllModesData: (
      state: Draft<ModeState>,
      action: PayloadAction<{ [key: string]: ModeData }>
    ) => {
      state.allModesData = action.payload;
    },
    setSelectedModeId: (
      state: Draft<ModeState>,
      action: PayloadAction<string | null>
    ) => {
      state.selectedModeId = action.payload;
    },
    setAvailableTools: (
      state: Draft<ModeState>,
      action: PayloadAction<{ [key: string]: any }>
    ) => {
      state.availableTools = action.payload;
    },
  }
});

export const {
  setAllModesData,
  setSelectedModeId,
  setAvailableTools,
} = modeSlice.actions;

export default modeSlice.reducer;
