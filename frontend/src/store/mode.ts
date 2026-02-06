import { createSlice, type Draft, type PayloadAction } from '@reduxjs/toolkit';

export interface ModeData {
  name: string;
  builtin: boolean;
  prompt: string;
  temperature: number;
  top_p: number;
  max_tokens: number;
  additionalInfo: string[];
  tools: string[];
}

export interface ModeState {
  allModesData: { [key: string]: ModeData };
  selectedModeId: string | null;
  availableTools: { [key: string]: any };
  fileTree: any[];
}

const initialState: ModeState = {
  allModesData: {},
  selectedModeId: null,
  availableTools: {},
  fileTree: [],
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
    setFileTree: (
      state: Draft<ModeState>,
      action: PayloadAction<any[]>
    ) => {
      state.fileTree = action.payload;
    },
  }
});

export const {
  setAllModesData,
  setSelectedModeId,
  setAvailableTools,
  setFileTree,
} = modeSlice.actions;

export default modeSlice.reducer;
