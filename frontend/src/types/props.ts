/**
 * 组件 Props 类型定义统一存放
 *
 * 所有组件的 Props 接口都定义在这里，组件内不再定义本地接口
 */

import type { ChapterItem } from './store';
import type { ContextMenuItem, ModalCallbacks, FileChangeInfo, FileTreeNode, TerminalItem, TerminalSession, Checkpoint, FileChange, GitStatus, ModelInfo, ThemeConfig, UploadProgressRef } from './components';

// ==================== Layout / 布局组件 ====================

export interface LayoutComponentProps {
  chapterPanel: React.ReactNode;
  editorPanel: React.ReactNode;
  chatPanel: React.ReactNode;
}

export interface SidebarComponentProps {
  activePanel: string | null;
  setActivePanel: (panel: string | null) => void;
}

export interface SidebarItem {
  id: string;
  icon: any;
  label: string;
  panelId: string | null;
}

// ==================== Chapter / 章节树组件 ====================

export interface ChapterTreeItemProps {
  item: ChapterItem;
  level: number;
  creatingItem: {
    isCreating: boolean;
    isFolder: boolean;
    parentPath: string;
  };
  onConfirmCreate: (name: string) => void;
  onCancelCreate: () => void;
  props: {
    handleContextMenu: (e: React.MouseEvent, id: string, isFolder: boolean, title: string, parentPath: string) => void;
    selectedItem: { state: string | null; id: string | null; isFolder: boolean; itemTitle: string | null; itemParentPath: string | null };
    lastSelectedItem: { id: string | null };
    setSelectedItem: (item: { state: string | null; id: string | null; isFolder: boolean; itemTitle: string | null; itemParentPath: string | null }) => void;
    setModal: (modal: { show: boolean; message: string; onConfirm: (() => void) | null; onCancel: (() => void) | null }) => void;
    draggedItemId: string | null;
    setDraggedItemId: (id: string | null) => void;
    dropTargetId: string | null;
    setDropTargetId: (id: string | null) => void;
    handleMoveItem: (sourcePath: string, targetPath: string) => Promise<void>;
  };
}

export interface ChapterContextMenuProps {
  contextMenu: { show: boolean; x: number; y: number };
  selectedItem: { state: string | null; id: string | null; isFolder: boolean; itemTitle: string | null; itemParentPath: string | null };
  setSelectedItem: (item: { state: string | null; id: string | null; isFolder: boolean; itemTitle: string | null; itemParentPath: string | null }) => void;
  lastSelectedItem: { state: string | null; id: string | null; isFolder: boolean; itemTitle: string | null; itemParentPath: string | null };
  setLastSelectedItem: (item: { state: string | null; id: string | null; isFolder: boolean; itemTitle: string | null; itemParentPath: string | null }) => void;
  handleCloseContextMenu: () => void;
  handleCreateItem: (isFolder: boolean, parentPath: string) => void;
  setModal: (modal: { show: boolean; message: string; onConfirm: (() => void) | null; onCancel: (() => void) | null }) => void;
}

export interface CreateInputProps {
  isFolder: boolean;
  onConfirm: (name: string) => void;
  onCancel: () => void;
}

// ==================== Editor / 编辑器组件 ====================

export interface TabBarProps {
  tabBarId: string;
  tabBar: {
    tabs: string[];
    activeTabId: string | null;
  };
  isActive: boolean;
  dirtyTabIds: Set<string>;
  draggedIndex: number | null;
  dragOverIndex: number | null;
  scrollContainerRef: (el: HTMLDivElement | null) => void;
  onTabClick: (tabId: string) => void;
  onTabClose: (tabId: string) => void;
  onTabContextMenu: (e: React.MouseEvent, tabId: string) => void;
  onTabDragStart: (index: number) => void;
  onTabDragEnd: () => void;
  onTabDragOver: (index: number) => void;
  onTabDrop: (fromIndex: number, toIndex: number) => void;
}

export interface EditorContextMenuProps {
  visible: boolean;
  x: number;
  y: number;
  tabId: string | null;
  tabBarId: string | null;
  activeTabBarId: string | null;
  onClose: () => void;
}

export interface CloseTabConfirmModalProps {
  tabId: string | null;
  tabBarId: string | null;
  tabContent: string;
  onClose: () => void;
  onError: (error: string) => void;
}

export interface TabBarEditorAreaProps {
  tabBarId: string;
  tabBar: import('./store').TabBar;
}

export interface MonacoEditorProps {
  onChange?: (value: string | undefined) => void;
  tabBarId?: string;
}

// ==================== Modal / 通用模态框组件 ====================

export interface UnifiedModalButton {
  text: string;
  onClick: () => void;
  className?: string;
  loading?: boolean;
}

export interface UnifiedModalSelectOption {
  label: string;
  value: string;
}

export interface UnifiedModalInputField {
  label: string;
  type?: 'text' | 'password' | 'select' | 'textarea';
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  options?: (string | UnifiedModalSelectOption)[];
  autocompleteOptions?: string[];
  onAutocompleteSelect?: (value: string) => void;
}

export interface UnifiedModalProps {
  title?: string;
  message?: string;
  inputs?: UnifiedModalInputField[];
  buttons: UnifiedModalButton[];
}

export interface ErrorModalProps {
  errorMessage: string | null;
  onClose: () => void;
}

// ==================== Context Menu / 上下文菜单 ====================

export interface ContextMenuProps {
  visible: boolean;
  x: number;
  y: number;
  items: ContextMenuItem[];
  onClose?: () => void;
  positionType?: 'fixed' | 'absolute';
  enableKeyboard?: boolean;
  enableAutoAdjust?: boolean;
  className?: string;
}

// ==================== AI Provider / 模型提供商组件 ====================

export interface ProviderListPanelProps {}

export interface AddModelModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedProviderId: string | null;
}

export interface CustomProviderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (name: string) => Promise<void>;
}

export interface ProviderContextMenuProps {
  visible: boolean;
  x: number;
  y: number;
  providerId: string | null;
  providersData: Record<string, any>;
  onRename: (providerId: string) => void;
  onDelete: (providerId: string) => void;
  onClose: () => void;
  enableKeyboard?: boolean;
  enableAutoAdjust?: boolean;
}

export interface RenameProviderModalProps {
  isOpen: boolean;
  providerId: string;
  currentName: string;
  onClose: () => void;
  onSubmit: (providerId: string, newName: string) => Promise<void>;
}

export interface DeleteConfirmModalProps {
  isOpen: boolean;
  providerId: string;
  providerName: string;
  onClose: () => void;
  onConfirm: (providerId: string) => Promise<void>;
}

export interface NotificationModalProps {
  message: string;
  onClose: () => void;
}

// ==================== Agent / 模式组件 ====================

export interface ModeListPanelProps {}

export interface CustomModeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (name: string) => Promise<void>;
}

export interface ModeContextMenuProps {
  visible: boolean;
  x: number;
  y: number;
  modeId: string | null;
  modesData: Record<string, any>;
  onRename: (modeId: string) => void;
  onDelete: (modeId: string) => void;
  onClose: () => void;
  enableKeyboard?: boolean;
  enableAutoAdjust?: boolean;
}

export interface RenameModeModalProps {
  isOpen: boolean;
  modeId: string;
  currentName: string;
  onClose: () => void;
  onSubmit: (modeId: string, newName: string) => Promise<void>;
}

export interface DeleteModeConfirmModalProps {
  isOpen: boolean;
  modeId: string;
  modeName: string;
  onClose: () => void;
  onConfirm: (modeId: string) => Promise<void>;
}

// ==================== MCP / MCP 服务器组件 ====================

export interface ServerListPanelProps {}

export interface ServerDetailPanelProps {}

export interface ServerContextMenuProps {
  visible: boolean;
  x: number;
  y: number;
  serverId: string | null;
  serversData: Record<string, any>;
  onClose: () => void;
  onDelete: (serverId: string) => void;
  enableKeyboard?: boolean;
  enableAutoAdjust?: boolean;
}

export interface MCPDeleteConfirmModalProps {
  isOpen: boolean;
  serverId: string;
  serverName: string;
  onClose: () => void;
  onConfirm: (serverId: string) => Promise<void>;
}

export interface MCPNotificationModalProps {
  message: string;
  onClose: () => void;
}

// ==================== RAG / 知识库组件 ====================

export interface FilesManagerProps {
  uploadProgressRef: React.RefObject<UploadProgressRef | null>;
}

export interface HeaderBarProps {}

export interface AddKnowledgeBaseModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export interface BaseContextMenuProps {
  visible: boolean;
  x: number;
  y: number;
  knowledgeBaseId: string | null;
  onRename: (knowledgeBaseId: string) => void;
  onDelete: (knowledgeBaseId: string) => void;
  onClose: () => void;
  enableKeyboard?: boolean;
  enableAutoAdjust?: boolean;
}

export interface BaseDetailModalProps {
  isOpen: boolean;
  knowledgeBaseId: string | null;
  onClose: () => void;
}

export interface DeleteBaseConfirmModalProps {
  isOpen: boolean;
  knowledgeBaseId: string;
  knowledgeBaseName: string;
  onClose: () => void;
  onConfirm: (knowledgeBaseId: string) => Promise<void>;
}

export interface RenameBaseModalProps {
  isOpen: boolean;
  knowledgeBaseId: string;
  currentName: string;
  onClose: () => void;
  onSubmit: (knowledgeBaseId: string, newName: string) => Promise<void>;
}

// ==================== Chat / 聊天组件 ====================

export interface FilePathAutocompleteProps {
  isOpen: boolean;
  paths: string[];
  selectedIndex: number;
  query: string;
  onSelect: (path: string) => void;
  onClose: () => void;
}

// ==================== Search / 搜索组件 ====================

export interface SearchPanelProps {
  onClose?: () => void;
  onFileSelect: (filePath: string) => void;
  embedded?: boolean;
}

// ==================== Checkpoint / 存档组件 ====================

export interface CheckpointPanelProps {
  onDiffDisplay?: (diff: string, filePath: string) => void;
}

// ==================== Others / 其他组件 ====================

export interface TopActionBarProps {
  isLeftPanelCollapsed: boolean;
  leftPanelContent: 'chapter' | 'search' | 'checkpoint';
  onToggleCollapse: () => void;
  onLeftPanelContentChange: (content: 'chapter' | 'search' | 'checkpoint') => void;
  isTerminalVisible?: boolean;
  onToggleTerminal?: () => void;
}

export interface StatusLogoProps {
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

export interface WindowControlsProps {
  className?: string;
}

// ==================== Hooks / Hook 返回类型 ====================

export interface UseFilePathAutocompleteReturn {
  isOpen: boolean;
  filteredPaths: string[];
  selectedIndex: number;
  query: string;
  cursorPosition: number;
  setCursorPosition: (pos: number) => void;
  handleInputChange: (value: string, cursorPos: number) => void;
  handleKeyDown: (e: React.KeyboardEvent) => boolean;
  selectPath: (path: string) => string;
  closeAutocomplete: () => void;
}
