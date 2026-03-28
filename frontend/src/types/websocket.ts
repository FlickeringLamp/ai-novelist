/**
 * WebSocket 相关类型定义
 */

/** WebSocket 消息类型 */
export type MessageType =
  | 'file_change'
  | 'file_tree_update'
  | 'chat_stream'
  | 'chat_interrupt'
  | 'embedding_progress'
  | 'knowledge_update'
  | 'system_notify'
  | 'error'
  | 'ping'
  | 'pong';

/** WebSocket 消息结构 */
export interface WSMessage {
  type: MessageType;
  payload: any;
}

/** 文件变化事件 */
export interface FileChangeEvent {
  event: string;
  path: string;
}

/** 文件树更新事件 */
export interface FileTreeUpdateEvent {
  chapters: any[];
}

/** WebSocket 客户端选项 */
export interface WSClientOptions {
  /** WebSocket URL */
  url: string;
  /** 自动重连间隔（毫秒） */
  reconnectInterval?: number;
  /** 最大重连次数，null 表示无限 */
  maxReconnectAttempts?: number | null;
  /** 心跳间隔（毫秒） */
  heartbeatInterval?: number;
  /** 连接超时（毫秒） */
  connectionTimeout?: number;
}

/** 消息处理器 */
export type MessageHandler = (payload: any) => void;

/** 连接处理器 */
export type ConnectionHandler = () => void;

/** 文件监控 Hook 选项 */
export interface UseFileWatcherOptions {
  /** 自动刷新文件树 */
  autoRefresh?: boolean;
  /** 防抖延迟（毫秒） */
  debounceMs?: number;
  /** 文件变化回调 */
  onFileChange?: (event: string, path: string) => void;
}
