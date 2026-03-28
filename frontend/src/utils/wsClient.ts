/**
 * WebSocket 客户端 - 单连接简化版
 * 
 * 只提供基础封装：
 * - 自动重连
 * - 心跳检测
 * - 连接状态管理
 * 
 * 消息处理交给业务层自己判断
 */

import type {
  WSMessage,
  WSClientOptions,
} from '../types/websocket';

export class WSClient {
  private ws: WebSocket | null = null;
  private options: Required<WSClientOptions>;
  
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private connectionTimeoutTimer: ReturnType<typeof setTimeout> | null = null;
  
  private isConnecting = false;
  private isManuallyClosed = false;

  private messageHandlers: Array<(message: WSMessage) => void> = [];
  private connectHandlers: Array<() => void> = [];
  private disconnectHandlers: Array<() => void> = [];

  constructor(options: WSClientOptions) {
    this.options = {
      reconnectInterval: 3000,
      maxReconnectAttempts: null,
      heartbeatInterval: 30000,
      connectionTimeout: 10000,
      ...options,
    };
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
        this.ws = new WebSocket(this.options.url);
        
        this.ws.onopen = () => {
          this.clearConnectionTimeout();
          this.isConnecting = false;
          this.reconnectAttempts = 0;
          this.startHeartbeat();
          // 触发所有连接处理器
          this.connectHandlers.forEach(handler => {
            try {
              handler();
            } catch (e) {
              console.error('连接处理器执行错误:', e);
            }
          });
          resolve();
        };

        this.ws.onmessage = (event) => {
          this.handleMessage(event.data);
        };

        this.ws.onclose = () => {
          this.clearConnectionTimeout();
          this.isConnecting = false;
          this.stopHeartbeat();
          // 触发所有断开连接处理器
          this.disconnectHandlers.forEach(handler => {
            try {
              handler();
            } catch (e) {
              console.error('断开连接处理器执行错误:', e);
            }
          });
          this.attemptReconnect();
        };

        this.ws.onerror = (error) => {
          this.clearConnectionTimeout();
          this.isConnecting = false;
          console.error('WebSocket 错误:', error);
          reject(new Error('WebSocket 连接失败'));
        };
      } catch (error) {
        this.clearConnectionTimeout();
        this.isConnecting = false;
        reject(error);
      }
    });
  }

  /** 清除重连定时器 */
  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
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
  send(type: string, payload: unknown = {}): boolean {
    if (this.ws?.readyState !== WebSocket.OPEN) {
      console.warn('WebSocket 未连接，无法发送消息');
      return false;
    }

    try {
      const message: WSMessage = { type: type as any, payload };
      this.ws.send(JSON.stringify(message));
      return true;
    } catch (error) {
      console.error('发送消息失败:', error);
      return false;
    }
  }

  /** 发送心跳 */
  private sendPing(): void {
    this.send('ping', { timestamp: Date.now() });
  }

  /** 处理收到的消息 */
  private handleMessage(data: string): void {
    try {
      const message = JSON.parse(data) as WSMessage;
      // 触发所有消息处理器
      this.messageHandlers.forEach(handler => {
        try {
          handler(message);
        } catch (e) {
          console.error('消息处理器执行错误:', e);
        }
      });
    } catch (error) {
      console.error('解析消息失败:', error);
    }
  }

  /** 添加消息处理器，返回取消订阅函数 */
  onMessage(handler: (message: WSMessage) => void): () => void {
    this.messageHandlers.push(handler);
    return () => {
      const index = this.messageHandlers.indexOf(handler);
      if (index > -1) {
        this.messageHandlers.splice(index, 1);
      }
    };
  }

  /** 添加连接成功处理器，返回取消订阅函数 */
  onConnect(handler: () => void): () => void {
    this.connectHandlers.push(handler);
    // 如果已经连接，立即执行
    if (this.isConnected) {
      try {
        handler();
      } catch (e) {
        console.error('连接处理器执行错误:', e);
      }
    }
    return () => {
      const index = this.connectHandlers.indexOf(handler);
      if (index > -1) {
        this.connectHandlers.splice(index, 1);
      }
    };
  }

  /** 添加断开连接处理器，返回取消订阅函数 */
  onDisconnect(handler: () => void): () => void {
    this.disconnectHandlers.push(handler);
    return () => {
      const index = this.disconnectHandlers.indexOf(handler);
      if (index > -1) {
        this.disconnectHandlers.splice(index, 1);
      }
    };
  }

  /** 获取连接状态 */
  get readyState(): number {
    return this.ws?.readyState ?? WebSocket.CLOSED;
  }

  get isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  get isConnectingState(): boolean {
    return this.isConnecting;
  }

  /** 启动心跳 */
  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      if (this.isConnected) {
        this.sendPing();
      }
    }, this.options.heartbeatInterval);
  }

  /** 停止心跳 */
  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  /** 尝试重连 */
  private attemptReconnect(): void {
    if (this.isManuallyClosed) return;

    const { maxReconnectAttempts, reconnectInterval } = this.options;
    
    if (maxReconnectAttempts !== null && this.reconnectAttempts >= maxReconnectAttempts) {
      console.log('达到最大重连次数，停止重连');
      return;
    }

    this.reconnectAttempts++;
    console.log(`WebSocket ${this.reconnectAttempts} 秒后尝试重连...`);

    this.reconnectTimer = setTimeout(() => {
      this.connect().catch(() => {
        // 重连失败会继续触发 onclose，然后再次尝试
      });
    }, reconnectInterval);
  }

  /** 清除连接超时定时器 */
  private clearConnectionTimeout(): void {
    if (this.connectionTimeoutTimer) {
      clearTimeout(this.connectionTimeoutTimer);
      this.connectionTimeoutTimer = null;
    }
  }
}

// 单例实例
let wsClientInstance: WSClient | null = null;

/** 获取 WebSocket 客户端单例 */
export function getWSClient(url: string): WSClient {
  if (!wsClientInstance) {
    wsClientInstance = new WSClient({ url });
  }
  return wsClientInstance;
}

/** 销毁 WebSocket 客户端 */
export function destroyWSClient(): void {
  if (wsClientInstance) {
    wsClientInstance.disconnect();
    wsClientInstance = null;
  }
}
