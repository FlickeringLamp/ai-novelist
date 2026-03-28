/**
 * Redux Store 状态类型定义
 * 
 * 集中管理所有 Slice 的状态类型
 */

// ==================== Chat Store ====================
import type {
  LangGraphState,
  ToolCall,
  UsageMetadata
} from './langgraph';

/** 两步 RAG 配置 */
export interface TwoStepRagConfig {
  id: string | null;
  name: string | null;
}

/** 聊天状态 */
export interface ChatState {
  /** 完整的 state 对象 */
  state: LangGraphState | null;
  /** 输入框消息 */
  message: string;
  /** 模式展开状态 */
  modeExpanded: boolean;
  /** 自动批准展开状态 */
  autoApproveExpanded: boolean;
  /** 自动批准启用状态 */
  autoApproveEnabled: boolean;
  /** 工具请求栏显示状态 */
  toolRequestVisible: boolean;
  /** 两步 RAG 配置 */
  twoStepRagConfig: TwoStepRagConfig;
  /** 两步 RAG 展开状态 */
  twoStepRagExpanded: boolean;
  /** 历史面板展开状态 */
  historyExpanded: boolean;
  /** 选中的 thread_id */
  selectedThreadId: string | null;
  /** 选中的模式 ID */
  selectedModeId: string | null;
  /** 是否正在流式传输 */
  isStreaming: boolean;
}

// ==================== Editor Store ====================

/** 标签栏 */
export interface TabBar {
  tabs: string[];
  activeTabId: string | null;
}

/** 编辑器状态 */
export interface EditorState {
  tabBars: Record<string, TabBar>;
  activeTabBarId: string;
  /** 用户实时操作的数据 */
  currentData: Record<string, string>;
  /** 备份数据，用于对比显示脏数据 */
  backUp: Record<string, string>;
  /** 处于差异对比模式的标签 ID 集合 */
  diffModeTabs: Record<string, boolean>;
  /** 存档点预览的旧版本内容 */
  checkpointContent: Record<string, string>;
  /** 处于存档点预览模式的标签 ID 集合 */
  checkpointPreviewTabs: Record<string, boolean>;
}

// ==================== File Store ====================

/** 章节/文件树项目 */
export interface ChapterItem {
  id: string;
  title?: string;
  isFolder?: boolean;
  type?: string;
  children?: ChapterItem[];
}

/** 文件状态 */
export interface FileState {
  collapsedChapters: Record<string, boolean>;
  chapters: ChapterItem[];
}

// ==================== Knowledge Store ====================

/** 知识库 */
export interface KnowledgeBase {
  name: string;
  provider: string;
  model: string;
  chunkSize: number;
  overlapSize: number;
  similarity: number;
  returnDocs: number;
}

/** 文件上传状态 */
export interface UploadFileState {
  current: number;
  total: number;
  percentage: number;
  message: string;
}

/** 知识库状态 */
export interface KnowledgeState {
  knowledgeBases: { [key: string]: KnowledgeBase };
  selectedKnowledgeBaseId: string | null;
  fileRefreshTrigger: number;
  uploadProgress: { [knowledgeBaseId: string]: UploadFileState | null };
  uploading: { [knowledgeBaseId: string]: boolean };
}

// ==================== MCP Store ====================

import type { MCPData, mcpServers, MCPTool } from './mcp';

/** MCP 状态 */
export interface MCPState {
  mcpData: MCPData;
  /** 正在加载工具的服务器 ID 列表 */
  loadingServers: string[];
}

export type { MCPData, mcpServers, MCPTool };

// ==================== Mode Store ====================

/** 模式数据 */
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

/** 模式状态 */
export interface ModeState {
  allModesData: { [key: string]: ModeData };
  selectedModeId: string | null;
  availableTools: { [key: string]: any };
}

// ==================== Provider Store ====================

/** 收藏模型分类 */
export interface FavoriteModels {
  chat: { [key: string]: any };
  embedding: { [key: string]: any };
  other: { [key: string]: any };
}

/** 提供商数据 */
export interface ProviderData {
  name: string;
  enable: boolean;
  url: string;
  key: string;
  favoriteModels: FavoriteModels;
}

/** 提供商状态 */
export interface ProviderState {
  allProvidersData: { [key: string]: ProviderData };
  selectedProviderId: string | null;
  selectedModelId: string | null;
}

// ==================== Terminal Store ====================

/** 终端状态 */
export interface TerminalState {
  isVisible: boolean;
}

// ==================== Root State ====================

import type { store } from '../store/store';

/** 根状态类型 */
export type RootState = ReturnType<typeof store.getState>;

/** App Dispatch 类型 */
export type AppDispatch = typeof store.dispatch;

// ==================== Store 本地类型别名 ====================
// 这些类型仅用于特定 slice 文件内部，用于 createSelector 的类型推断

/** EditorSlice 专用的 RootState 别名（用于 editor.ts 中的 selector） */
export interface EditorSliceRootState {
  tabSlice: EditorState;
}
