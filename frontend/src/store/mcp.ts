import { createSlice, type Draft, type PayloadAction } from '@reduxjs/toolkit';
import type { MCPData, mcpServers, MCPTool } from '../types/mcp';

export interface MCPState {
  mcpData: MCPData;
  loadingServers: string[]; // 正在加载工具的服务器ID列表
}

const initialState: MCPState = {
  mcpData: {
    selectedId: null,
    config: {},
    tools: {},
    toolsError: {},
  },
  loadingServers: [],
};

export const mcpSlice = createSlice({
  name: 'mcpSlice',
  initialState,
  reducers: {
    // 设置选中的服务器ID
    setSelectedServerId: (
      state: Draft<MCPState>,
      action: PayloadAction<string | null>
    ) => {
      state.mcpData.selectedId = action.payload;
    },
    // 设置所有服务器配置
    setAllServersConfig: (
      state: Draft<MCPState>,
      action: PayloadAction<{ [serverId: string]: mcpServers }>
    ) => {
      state.mcpData.config = action.payload;
    },
    // 设置单个服务器的工具列表
    setServerTools: (
      state: Draft<MCPState>,
      action: PayloadAction<{ serverId: string; tools: MCPTool[]; error?: string | null }>
    ) => {
      const { serverId, tools, error } = action.payload;
      state.mcpData.tools[serverId] = tools;
      state.mcpData.toolsError[serverId] = error ?? null;
    },
    // 添加或更新服务器
    saveServer: (
      state: Draft<MCPState>,
      action: PayloadAction<{ serverId: string; config: mcpServers }>
    ) => {
      state.mcpData.config[action.payload.serverId] = action.payload.config;
    },
    // 删除服务器
    deleteServer: (
      state: Draft<MCPState>,
      action: PayloadAction<string>
    ) => {
      const serverId = action.payload;
      delete state.mcpData.config[serverId];
      // 同时清理对应的 tools 和 toolsError
      delete state.mcpData.tools[serverId];
      delete state.mcpData.toolsError[serverId];
      // 如果删除的是当前选中的服务器，清空选中状态
      if (state.mcpData.selectedId === serverId) {
        state.mcpData.selectedId = null;
      }
    },
    // 设置服务器加载状态
    setServerLoading: (
      state: Draft<MCPState>,
      action: PayloadAction<{ serverId: string; loading: boolean }>
    ) => {
      const { serverId, loading } = action.payload;
      const exists = state.loadingServers.includes(serverId);
      if (loading && !exists) {
        state.loadingServers.push(serverId);
      } else if (!loading && exists) {
        state.loadingServers = state.loadingServers.filter(id => id !== serverId);
      }
    },
  },
});

export const {
  setSelectedServerId,
  setAllServersConfig,
  setServerTools,
  saveServer,
  deleteServer,
  setServerLoading,
} = mcpSlice.actions;

export default mcpSlice.reducer;
