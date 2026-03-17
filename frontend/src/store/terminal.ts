import { createSlice } from '@reduxjs/toolkit';

export interface TerminalState {
  isVisible: boolean;
}

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
