import { createSlice, type Draft, type PayloadAction } from '@reduxjs/toolkit';
import type { MCPServerConfig, MCPToolsData } from '../types/mcp';

export interface MCPState {
  allServersData: { [serverId: string]: MCPServerConfig };
  selectedServerId: string | null;
  serverTools: { [serverId: string]: MCPToolsData };
  isLoading: boolean;
  loadingServers: string[]; // 正在加载工具的服务器ID列表
}

const initialState: MCPState = {
  allServersData: {},
  selectedServerId: null,
  serverTools: {},
  isLoading: false,
  loadingServers: [],
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
    setServerTools: (
      state: Draft<MCPState>,
      action: PayloadAction<{ [serverId: string]: MCPToolsData }>
    ) => {
      state.serverTools = action.payload;
    },
    setSingleServerTools: (
      state: Draft<MCPState>,
      action: PayloadAction<{ serverId: string; tools: MCPToolsData }>
    ) => {
      state.serverTools[action.payload.serverId] = action.payload.tools;
    },
    setLoading: (
      state: Draft<MCPState>,
      action: PayloadAction<boolean>
    ) => {
      state.isLoading = action.payload;
    },
    addLoadingServer: (
      state: Draft<MCPState>,
      action: PayloadAction<string>
    ) => {
      if (!state.loadingServers.includes(action.payload)) {
        state.loadingServers.push(action.payload);
      }
    },
    removeLoadingServer: (
      state: Draft<MCPState>,
      action: PayloadAction<string>
    ) => {
      state.loadingServers = state.loadingServers.filter(id => id !== action.payload);
    },
    clearLoadingServers: (
      state: Draft<MCPState>
    ) => {
      state.loadingServers = [];
    },
  },
});

export const {
  setAllServersData,
  setSelectedServerId,
  setServerTools,
  setSingleServerTools,
  setLoading,
  addLoadingServer,
  removeLoadingServer,
  clearLoadingServers,
} = mcpSlice.actions;

export default mcpSlice.reducer;
