/**
 * WebSocket 客户端 - 通用封装
 * 
 * 支持：
 * - 自动重连
 * - 心跳检测
 * - 消息订阅/发布
 * - 连接状态管理
 */

import type {
  MessageType,
  WSMessage,
  WSClientOptions,
  MessageHandler,
  ConnectionHandler
} from '../types/websocket';

export class WSClient {
  private ws: WebSocket | null = null;
  private options: Required<WSClientOptions>;
  private messageHandlers: Map<MessageType, Set<MessageHandler>> = new Map();
  private connectionHandlers: Set<ConnectionHandler> = new Set();
  private disconnectionHandlers: Set<ConnectionHandler> = new Set();
  
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private connectionTimeoutTimer: ReturnType<typeof setTimeout> | null = null;
  
  private isConnecting = false;
  private isManuallyClosed = false;

  constructor(options: WSClientOptions) {
    this.options = {
      clientId: this.generateClientId(),
      reconnectInterval: 3000,
      maxReconnectAttempts: null,
      heartbeatInterval: 30000,
      connectionTimeout: 10000,
      ...options,
    };
  }

  /** 生成客户端ID */
  private generateClientId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /** 获取完整 WebSocket URL */
  private getFullUrl(): string {
    const { url, connectionType, clientId } = this.options;
    return `${url}?type=${connectionType}&clientId=${clientId}`;
  }

  /** 连接 WebSocket */
  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        resolve();
        return;
      }

      if (this.isConnecting) {
        reject(new Error('连接正在进行中'));
        return;
      }

      this.isConnecting = true;
      this.isManuallyClosed = false;

      // 设置连接超时
      this.connectionTimeoutTimer = setTimeout(() => {
        this.ws?.close();
        this.isConnecting = false;
        reject(new Error('连接超时'));
      }, this.options.connectionTimeout);

      try {
        this.ws = new WebSocket(this.getFullUrl());

        this.ws.onopen = () => {
          this.clearConnectionTimeout();
          this.isConnecting = false;
          this.reconnectAttempts = 0;
          this.startHeartbeat();
          this.connectionHandlers.forEach((handler) => handler());
          resolve();
        };

        this.ws.onmessage = (event) => {
          this.handleMessage(event.data);
        };

        this.ws.onclose = () => {
          this.clearConnectionTimeout();
          this.isConnecting = false;
          this.stopHeartbeat();
          this.disconnectionHandlers.forEach((handler) => handler());
          
          if (!this.isManuallyClosed) {
            this.scheduleReconnect();
          }
        };

        this.ws.onerror = (error) => {
          this.clearConnectionTimeout();
          this.isConnecting = false;
          console.error('WebSocket 错误:', error);
        };
      } catch (error) {
        this.clearConnectionTimeout();
        this.isConnecting = false;
        reject(error);
      }
    });
  }

  /** 断开连接 */
  disconnect(): void {
    this.isManuallyClosed = true;
    this.clearReconnectTimer();
    this.stopHeartbeat();
    
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  /** 发送消息 */
  send(type: MessageType, payload: any): boolean {
    if (this.ws?.readyState !== WebSocket.OPEN) {
      console.warn('WebSocket 未连接，无法发送消息');
      return false;
    }

    try {
      const message: WSMessage = { type, payload };
      this.ws.send(JSON.stringify(message));
      return true;
    } catch (error) {
      console.error('发送消息失败:', error);
      return false;
    }
  }

  /** 订阅消息 */
  on(type: MessageType, handler: MessageHandler): () => void {
    if (!this.messageHandlers.has(type)) {
      this.messageHandlers.set(type, new Set());
    }
    this.messageHandlers.get(type)!.add(handler);

    // 返回取消订阅函数
    return () => {
      this.messageHandlers.get(type)?.delete(handler);
    };
  }

  /** 订阅连接成功事件 */
  onConnect(handler: ConnectionHandler): () => void {
    this.connectionHandlers.add(handler);
    return () => {
      this.connectionHandlers.delete(handler);
    };
  }

  /** 订阅断开连接事件 */
  onDisconnect(handler: ConnectionHandler): () => void {
    this.disconnectionHandlers.add(handler);
    return () => {
      this.disconnectionHandlers.delete(handler);
    };
  }

  /** 检查连接状态 */
  get isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  /** 获取客户端ID */
  get clientId(): string {
    return this.options.clientId;
  }

  /** 处理收到的消息 */
  private handleMessage(data: string): void {
    try {
      const message: WSMessage = JSON.parse(data);
      const handlers = this.messageHandlers.get(message.type);
      
      if (handlers) {
        handlers.forEach((handler) => {
          try {
            handler(message.payload);
          } catch (error) {
            console.error(`消息处理器错误 (${message.type}):`, error);
          }
        });
      }
    } catch (error) {
      console.error('解析消息失败:', error);
    }
  }

  /** 启动心跳 */
  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      this.send('ping', { timestamp: Date.now() });
    }, this.options.heartbeatInterval);
  }

  /** 停止心跳 */
  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  /** 计划重连 */
  private scheduleReconnect(): void {
    const { maxReconnectAttempts, reconnectInterval } = this.options;
    
    if (maxReconnectAttempts !== null && this.reconnectAttempts >= maxReconnectAttempts) {
      console.warn('达到最大重连次数，停止重连');
      return;
    }

    this.reconnectAttempts++;
    console.log(`计划重连 (${this.reconnectAttempts}/${maxReconnectAttempts ?? '∞'})...`);

    this.reconnectTimer = setTimeout(() => {
      this.connect().catch(() => {
        // 连接失败，下次触发 onclose 会继续重连
      });
    }, reconnectInterval);
  }

  /** 清除重连定时器 */
  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  /** 清除连接超时定时器 */
  private clearConnectionTimeout(): void {
    if (this.connectionTimeoutTimer) {
      clearTimeout(this.connectionTimeoutTimer);
      this.connectionTimeoutTimer = null;
    }
  }
}

/** 创建文件监控 WebSocket 客户端 */
export const createFileWSClient = (): WSClient => {
  return new WSClient({
    url: 'ws://localhost:8000/ws',
    connectionType: 'file',
  });
};

/** 创建聊天 WebSocket 客户端 */
export const createChatWSClient = (): WSClient => {
  return new WSClient({
    url: 'ws://localhost:8000/ws',
    connectionType: 'chat',
  });
};
