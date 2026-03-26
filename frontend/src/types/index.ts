/**
 * 类型定义统一导出
 * 
 * 使用方式：
 * ```typescript
 * import type { ChatState, WSMessage, ApiResponse } from '@/types';
 * ```
 */

// ==================== Store 类型 ====================
export type {
  // Chat
  ChatState,
  TwoStepRagConfig,
  // Editor
  TabBar,
  EditorState,
  // File
  ChapterItem,
  FileState,
  // Knowledge
  KnowledgeBase,
  UploadFileState as KnowledgeUploadFileState,
  KnowledgeState,
  // MCP
  MCPState,
  // Mode
  ModeData,
  ModeState,
  // Provider
  FavoriteModels,
  ProviderData,
  ProviderState,
  // Terminal
  TerminalState,
  // Root
  RootState,
  AppDispatch,
  // Store 内部类型
  EditorSliceRootState,
} from './store';

// ==================== LangGraph 类型 ====================
export type {
  ToolCall,
  InvalidToolCall,
  UsageMetadata,
  ResponseMetadata,
  BaseMessage,
  HumanMessage,
  AIMessage,
  ToolMessage,
  Message,
  InterruptValue,
  Interrupt,
  InterruptResponse,
  PregelTask,
  Config,
  StateMetadata,
  LangGraphState,
  StreamChunk,
  ToolCallChunk,
} from './langgraph';

// ==================== MCP 类型 ====================
export type {
  MCPTool,
  mcpServers,
  MCPData,
} from './mcp';

// ==================== WebSocket 类型 ====================
export type {
  MessageType,
  WSMessage,
  FileChangeEvent,
  FileTreeUpdateEvent,
  WSClientOptions,
  MessageHandler,
  ConnectionHandler,
  UseFileWatcherOptions,
} from './websocket';

// ==================== API 类型 ====================
export type {
  ApiResponse,
  PaginationParams,
  PaginatedResponse,
  SearchRequest,
  SearchResult,
  FileOperationRequest,
  RenameRequest,
  HealthStatus,
  // Git Checkpoint
  ApiCheckpoint,
  ApiFileChange,
  ApiGitChange,
  ApiGitStatus,
} from './api';

// ==================== 组件共享类型 ====================
export type {
  ButtonConfig,
  SelectOption,
  InputFieldConfig,
  ContextMenuItem,
  ContextMenuPosition,
  ModalCallbacks,
  FileChangeType,
  FileChangeInfo,
  FileTreeNode,
  DragState,
  TerminalItem,
  TerminalSession,
  Checkpoint,
  FileChange,
  GitStatus,
  UploadProgressRef,
  ModelInfo,
  ThemeConfig,
  // RAG
  RagFileSearchResult,
  KnowledgeContextMenu,
  // Search
  FileSearchResult,
  // Chat
  ChatSession,
  // Editor
  ThemeColors,
  EditorRootState,
  // MCP / Agent
  McpTabType,
  ModeTabType,
  // Health
  LocalHealthStatus,
} from './components';

// ==================== Electron API (全局声明) ====================
// electron.d.ts 中的类型通过全局声明可用，不需要显式导出

// ==================== Props 类型 ====================
export type {
  // Layout
  LayoutComponentProps,
  SidebarComponentProps,
  SidebarItem,
  // Chapter
  ChapterTreeItemProps,
  ChapterContextMenuProps,
  CreateInputProps,
  // Editor
  TabBarProps,
  EditorContextMenuProps,
  CloseTabConfirmModalProps,
  TabBarEditorAreaProps,
  MonacoEditorProps,
  // Modal
  UnifiedModalProps,
  UnifiedModalButton,
  UnifiedModalSelectOption,
  UnifiedModalInputField,
  ErrorModalProps,
  // Context Menu
  ContextMenuProps,
  // AI Provider
  ProviderListPanelProps,
  AddModelModalProps,
  CustomProviderModalProps,
  ProviderContextMenuProps,
  RenameProviderModalProps,
  DeleteConfirmModalProps,
  NotificationModalProps,
  // Agent
  ModeListPanelProps,
  CustomModeModalProps,
  ModeContextMenuProps,
  RenameModeModalProps,
  DeleteModeConfirmModalProps,
  // MCP
  ServerListPanelProps,
  ServerDetailPanelProps,
  ServerContextMenuProps,
  MCPDeleteConfirmModalProps,
  MCPNotificationModalProps,
  // RAG
  FilesManagerProps,
  HeaderBarProps,
  AddKnowledgeBaseModalProps,
  BaseContextMenuProps,
  BaseDetailModalProps,
  DeleteBaseConfirmModalProps,
  RenameBaseModalProps,
  // Chat
  FilePathAutocompleteProps,
  // Search
  SearchPanelProps,
  // Checkpoint
  CheckpointPanelProps,
  // Others
  TopActionBarProps,
  StatusLogoProps,
  WindowControlsProps,
  // Hooks
  UseFilePathAutocompleteReturn,
} from './props';
