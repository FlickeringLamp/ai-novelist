import {
  createSlice,
  type PayloadAction,
  type Draft,
} from "@reduxjs/toolkit";
import type {
  LangGraphState,
  ToolCall,
  UsageMetadata
} from '../types/langgraph';
import type { ChatState } from '../types/store';

// 初始状态
const initialState: ChatState = {
  state: null,
  message: '',
  modeExpanded: false,
  autoApproveExpanded: false,
  autoApproveEnabled: false,
  toolRequestVisible: false,
  twoStepRagConfig: { id: null, name: null },
  twoStepRagExpanded: false,
  historyExpanded: false,
  selectedThreadId: null,
  selectedModeId: null,
  isStreaming: false,
};

export const chatSlice = createSlice({
  name: "chatSlice",
  initialState,
  reducers: {
    // 设置完整的state
    setState: (state: Draft<ChatState>, action: PayloadAction<LangGraphState | null>) => {
      state.state = action.payload;
    },
    
    // 添加用户消息
    addUserMessage: (state: Draft<ChatState>, action: PayloadAction<{ id: string; content: string }>) => {
      const { id, content } = action.payload;
      if (!state.state) return;
      
      const newMessages = [...state.state.values.messages];
      newMessages.push({
        id,
        type: 'human',
        content,
        additional_kwargs: {},
        response_metadata: {}
      });
      
      state.state = {
        ...state.state,
        values: {
          ...state.state.values,
          messages: newMessages
        }
      };
    },

    // 添加工具消息
    addToolMessage: (state: Draft<ChatState>, action: PayloadAction<{ id: string; content: string; tool_call_id?: string; name?: string }>) => {
      const { id, content, tool_call_id, name } = action.payload;
      if (!state.state) return;

      const newMessages = [...state.state.values.messages];
      newMessages.push({
        id,
        type: 'tool',
        content,
        tool_call_id: tool_call_id || id,
        additional_kwargs: { _temporary: true, _tool_name: name },
        response_metadata: {}
      });

      state.state = {
        ...state.state,
        values: {
          ...state.state.values,
          messages: newMessages
        }
      };
    },

    // 创建AI消息（用于流式传输开始）
    createAiMessage: (state: Draft<ChatState>, action: PayloadAction<{ id: string }>) => {
      const { id } = action.payload;
      if (!state.state) return;
      
      const newMessages = [...state.state.values.messages];
      newMessages.push({
        id,
        type: 'ai',
        content: '',
        additional_kwargs: {},
        response_metadata: {},
        tool_calls: [],
        invalid_tool_calls: []
      });
      
      state.state = {
        ...state.state,
        values: {
          ...state.state.values,
          messages: newMessages
        }
      };
    },
    
    // 更新AI消息内容（流式传输）
    updateAiMessage: (state: Draft<ChatState>, action: PayloadAction<{ id: string; content: string; tool_calls?: ToolCall[]; usage_metadata?: UsageMetadata; reasoning_content?: string }>) => {
      const { id, content, tool_calls, usage_metadata, reasoning_content } = action.payload;
      if (!state.state) return;
      
      const messageIndex = state.state.values.messages.findIndex(msg => msg.id === id);
      if (messageIndex === -1) return;
      
      const currentMessage = state.state.values.messages[messageIndex]!;
      const newMessages = [...state.state.values.messages];
      
      if (currentMessage.type === 'ai') {
        const updatedMessage: any = {
          ...currentMessage,
          content,
          tool_calls: tool_calls !== undefined ? tool_calls : currentMessage.tool_calls
        };
        if (usage_metadata !== undefined) {
          updatedMessage.usage_metadata = usage_metadata;
        }
        if (reasoning_content !== undefined) {
          updatedMessage.additional_kwargs = {
            ...currentMessage.additional_kwargs,
            reasoning_content
          };
        }
        newMessages[messageIndex] = updatedMessage;
      } else {
        newMessages[messageIndex] = {
          ...currentMessage,
          content
        };
      }
      
      state.state = {
        ...state.state,
        values: {
          ...state.state.values,
          messages: newMessages
        }
      };
    },
    
    // 设置输入框消息
    setMessage: (state: Draft<ChatState>, action: PayloadAction<string>) => {
      state.message = action.payload;
    },
    
    // 切换模式展开状态
    toggleModeExpanded: (state: Draft<ChatState>) => {
      state.modeExpanded = !state.modeExpanded;
    },
    
    // 切换自动批准展开状态
    toggleAutoApproveExpanded: (state: Draft<ChatState>) => {
      state.autoApproveExpanded = !state.autoApproveExpanded;
    },

    // 设置自动批准启用状态
    setAutoApproveEnabled: (state: Draft<ChatState>, action: PayloadAction<boolean>) => {
      state.autoApproveEnabled = action.payload;
    },
    
    // 清除所有聊天数据
    clearChat: (state: Draft<ChatState>) => {
      state.state = null;
      state.message = '';
      state.modeExpanded = false;
      state.autoApproveExpanded = false;
      state.toolRequestVisible = false;
    },

    // 设置工具请求栏显示状态
    setToolRequestVisible: (state: Draft<ChatState>, action: PayloadAction<boolean>) => {
      state.toolRequestVisible = action.payload;
    },

    // 清除中断
    clearInterrupt: (state: Draft<ChatState>) => {
      if (state.state) {
        state.state.interrupts = [];
      }
    },

    // 设置两步RAG配置
    setTwoStepRagConfig: (state: Draft<ChatState>, action: PayloadAction<{ id: string | null; name: string | null }>) => {
      state.twoStepRagConfig = action.payload;
    },

    // 切换两步RAG展开状态
    setTwoStepRagExpanded: (state: Draft<ChatState>, action: PayloadAction<boolean>) => {
      state.twoStepRagExpanded = action.payload;
    },

    // 设置模式展开状态
    setModeExpanded: (state: Draft<ChatState>, action: PayloadAction<boolean>) => {
      state.modeExpanded = action.payload;
    },

    // 切换历史面板展开状态
    setHistoryExpanded: (state: Draft<ChatState>, action: PayloadAction<boolean>) => {
      state.historyExpanded = action.payload;
    },

    // 设置选中的thread_id
    setSelectedThreadId: (state: Draft<ChatState>, action: PayloadAction<string | null>) => {
      state.selectedThreadId = action.payload;
    },

    // 设置选中的模式ID
    setSelectedModeId: (state: Draft<ChatState>, action: PayloadAction<string | null>) => {
      state.selectedModeId = action.payload;
    },

    // 设置是否正在流式传输
    setIsStreaming: (state: Draft<ChatState>, action: PayloadAction<boolean>) => {
      state.isStreaming = action.payload;
    },
  },
});

export const {
  setState,
  addUserMessage,
  addToolMessage,
  createAiMessage,
  updateAiMessage,
  setMessage,
  toggleModeExpanded,
  toggleAutoApproveExpanded,
  setAutoApproveEnabled,
  clearChat,
  setToolRequestVisible,
  clearInterrupt,
  setTwoStepRagConfig,
  setTwoStepRagExpanded,
  setModeExpanded,
  setHistoryExpanded,
  setSelectedThreadId,
  setSelectedModeId,
  setIsStreaming,
} = chatSlice.actions;

export default chatSlice.reducer;

