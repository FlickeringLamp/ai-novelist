import { createSlice } from '@reduxjs/toolkit';
import type { TerminalState } from '../types/store';

// TerminalState 类型定义已迁移到 types/store.ts

const initialState: TerminalState = {
  isVisible: false,
};

const terminalSlice = createSlice({
  name: 'terminal',
  initialState,
  reducers: {
    toggleTerminal: (state) => {
      state.isVisible = !state.isVisible;
    },
  },
});

export const { toggleTerminal } = terminalSlice.actions;

export default terminalSlice.reducer;
