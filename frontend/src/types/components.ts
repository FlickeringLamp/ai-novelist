import type { ChapterItem, EditorState } from './store';
import type { HealthStatus } from './api';

// ==================== 通用 UI 类型 ====================

/** 按钮配置 */
export interface ButtonConfig {
  text: string;
  onClick?: () => void;
  primary?: boolean;
  danger?: boolean;
  disabled?: boolean;
}

/** 选择选项 */
export interface SelectOption {
  label: string;
  value: string;
  disabled?: boolean;
}

/** 输入字段配置 */
export interface InputFieldConfig {
  label: string;
  key: string;
  type?: 'text' | 'password' | 'number' | 'textarea' | 'select';
  placeholder?: string;
  defaultValue?: string;
  options?: SelectOption[];
  required?: boolean;
  validate?: (value: string) => string | null;
}

/** 上下文菜单项 */
export interface ContextMenuItem {
  label?: string;
  icon?: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  divider?: boolean;
  danger?: boolean;
}

/** 上下文菜单位置 */
export interface ContextMenuPosition {
  x: number;
  y: number;
}

/** 模态框回调 */
export interface ModalCallbacks {
  onConfirm?: () => void;
  onCancel?: () => void;
  onClose?: () => void;
}

// ==================== 文件/章节相关 ====================

/** 文件变化类型 */
export type FileChangeType = 'created' | 'modified' | 'deleted' | 'renamed' | 'moved';

/** 文件变化信息 */
export interface FileChangeInfo {
  type: FileChangeType;
  path: string;
  oldPath?: string;
  isDirectory?: boolean;
}

/** 文件树节点扩展属性 */
export interface FileTreeNode extends ChapterItem {
  level: number;
  isExpanded?: boolean;
  isSelected?: boolean;
  isLoading?: boolean;
}

/** 拖拽状态 */
export interface DragState {
  isDragging: boolean;
  draggedItem: ChapterItem | null;
  dragOverItem: ChapterItem | null;
  dropPosition: 'before' | 'after' | 'inside' | null;
}

// ==================== 终端相关 ====================

/** 终端项 */
export interface TerminalItem {
  id: string;
  name: string;
  isActive?: boolean;
}

/** 终端会话 */
export interface TerminalSession {
  id: string;
  name: string;
  output: string[];
  isRunning: boolean;
}

// ==================== Checkpoint/版本控制相关 ====================

/** Checkpoint 信息 */
export interface Checkpoint {
  commit_hash: string;
  message: string;
  timestamp: string;
  author: string;
}

/** 文件变化 */
export interface FileChange {
  path: string;
  change_type: 'added' | 'modified' | 'deleted';
  diff?: string;
}

/** Git 状态 */
export interface GitStatus {
  branch: string;
  ahead: number;
  behind: number;
  modified: string[];
  staged: string[];
  untracked: string[];
}

// ==================== RAG 相关 ====================

/** 上传进度引用 */
export interface UploadProgressRef {
  triggerFileInput: () => void;
}

/** 搜索结果 */
export interface SearchPanelResult {
  path: string;
  content: string;
  score?: number;
}

// ==================== Provider/模型相关 ====================

/** 模型信息 */
export interface ModelInfo {
  id: string;
  name: string;
  description?: string;
  maxTokens?: number;
  supportsStreaming?: boolean;
  supportsVision?: boolean;
}

// ==================== 主题相关 ====================

/** 主题配置 */
export interface ThemeConfig {
  name: string;
  colors: {
    primary: string;
    secondary: string;
    background: string;
    surface: string;
    text: string;
    textSecondary: string;
    border: string;
    error: string;
    warning: string;
    success: string;
    info: string;
  };
}

// ==================== RAG 相关（补充） ====================

/** RAG 知识库文件搜索结果 */
export interface RagFileSearchResult {
  content: string;
  metadata: Record<string, any>;
  score: number;
}

/** 知识库列表右键菜单状态 */
export interface KnowledgeContextMenu {
  visible: boolean;
  x: number;
  y: number;
  knowledgeBaseId: string | null;
}

// ==================== 全局搜索相关 ====================

/** 全局文件搜索结果 */
export interface FileSearchResult {
  path: string;
  content: string[];
}

// ==================== 会话历史相关 ====================

/** 聊天会话 */
export interface ChatSession {
  session_id: string;
  message_count: number;
  created_at: number | null;
  last_accessed: number | null;
  preview: string;
}

// ==================== 编辑器相关 ====================

/** 编辑器主题颜色 */
export interface ThemeColors {
  green: string;
  white: string;
  black: string;
  gray2: string;
  gray3: string;
  gray5: string;
}

/** 编辑器 Redux RootState（用于 EditorArea 组件的 selector） */
export interface EditorRootState {
  tabSlice: EditorState;
}

// ==================== MCP / Agent 面板 Tab 类型 ====================

/** MCP 服务器详情面板 Tab 类型 */
export type McpTabType = 'params' | 'tools';

/** Agent 模式详情面板 Tab 类型 */
export type ModeTabType = 'prompt' | 'params' | 'tools';

// ==================== 健康检查相关 ====================

/** 本地健康检查状态（扩展 HealthStatus） */
export interface LocalHealthStatus extends HealthStatus {
  lastCheckTime: Date | null;
  consecutiveFailures: number;
}
