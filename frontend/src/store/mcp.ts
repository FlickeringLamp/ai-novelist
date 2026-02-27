import { createSlice, type Draft, type PayloadAction } from '@reduxjs/toolkit';
import type { MCPServerConfig, MCPToolsData } from '../types/mcp';

export interface MCPState {
  allServersData: { [serverId: string]: MCPServerConfig };
  selectedServerId: string | null;
  tools: MCPToolsData;
  isLoading: boolean;
}

const initialState: MCPState = {
  allServersData: {},
  selectedServerId: null,
  tools: {},
  isLoading: false,
};

export const mcpSlice = createSlice({
  name: 'mcpSlice',
  initialState,
  reducers: {
    setAllServersData: (
      state: Draft<MCPState>,
      action: PayloadAction<{ [serverId: string]: MCPServerConfig }>
    ) => {
      state.allServersData = action.payload;
    },
    setSelectedServerId: (
      state: Draft<MCPState>,
      action: PayloadAction<string | null>
    ) => {
      state.selectedServerId = action.payload;
    },
    setTools: (
      state: Draft<MCPState>,
      action: PayloadAction<MCPToolsData>
    ) => {
      state.tools = action.payload;
    },
    setLoading: (
      state: Draft<MCPState>,
      action: PayloadAction<boolean>
    ) => {
      state.isLoading = action.payload;
    },
  },
});

export const {
  setAllServersData,
  setSelectedServerId,
  setTools,
  setLoading,
} = mcpSlice.actions;

export default mcpSlice.reducer;
