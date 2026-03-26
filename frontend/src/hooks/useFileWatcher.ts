/**
 * 文件监控 Hook - 整合 WebSocket 和 Redux
 * 
 * 功能：
 * - 自动连接文件监控 WebSocket
 * - 监听文件变化并自动刷新文件树
 * - 处理重连和错误
 */
import { useEffect, useRef, useCallback } from 'react';
import { useDispatch } from 'react-redux';
import { WSClient, createFileWSClient } from '../utils/wsClient';
import { setChapters } from '../store/file';
import httpClient from '../utils/httpClient';
import type { UseFileWatcherOptions } from '../types/websocket';

// UseFileWatcherOptions 类型定义已迁移到 types/websocket.ts

export const useFileWatcher = (options: UseFileWatcherOptions = {}) => {
  const {
    autoRefresh = true,
    debounceMs = 500,
    onFileChange,
  } = options;

  const dispatch = useDispatch();
  const wsClientRef = useRef<WSClient | null>(null);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isConnectedRef = useRef(false);

  /** 刷新文件树 */
  const refreshFileTree = useCallback(async () => {
    try {
      const result = await httpClient.get('/api/file/tree');
      dispatch(setChapters(result || []));
    } catch (error) {
      console.error('刷新文件树失败:', error);
    }
  }, [dispatch]);

  /** 防抖刷新 */
  const debouncedRefresh = useCallback(() => {
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
    }
    refreshTimerRef.current = setTimeout(() => {
      refreshFileTree();
    }, debounceMs);
  }, [refreshFileTree, debounceMs]);

  useEffect(() => {
    // 创建 WebSocket 客户端
    const wsClient = createFileWSClient();
    wsClientRef.current = wsClient;

    // 订阅文件变化
    const unsubscribeFileChange = wsClient.on('file_change', (payload) => {
      console.log('文件变化:', payload);
      
      // 调用自定义回调
      onFileChange?.(payload.event, payload.path);

      // 自动刷新文件树
      if (autoRefresh) {
        debouncedRefresh();
      }
    });

    // 订阅文件树更新（如果后端直接推送完整树）
    const unsubscribeTreeUpdate = wsClient.on('file_tree_update', (payload) => {
      console.log('收到文件树更新:', payload);
      if (payload.tree) {
        dispatch(setChapters(payload.tree));
      }
    });

    // 连接状态处理
    const unsubscribeConnect = wsClient.onConnect(() => {
      console.log('文件监控已连接');
      isConnectedRef.current = true;
    });

    const unsubscribeDisconnect = wsClient.onDisconnect(() => {
      console.log('文件监控已断开');
      isConnectedRef.current = false;
    });

    // 建立连接
    wsClient.connect().catch((error) => {
      console.error('文件监控连接失败:', error);
    });

    // 清理函数
    return () => {
      unsubscribeFileChange();
      unsubscribeTreeUpdate();
      unsubscribeConnect();
      unsubscribeDisconnect();
      
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
      }
      
      wsClient.disconnect();
      wsClientRef.current = null;
    };
  }, [autoRefresh, debounceMs, onFileChange, debouncedRefresh, dispatch]);

  return {
    /** 是否已连接 */
    get isConnected() {
      return isConnectedRef.current;
    },
    /** 手动刷新文件树 */
    refreshFileTree,
    /** 获取 WebSocket 客户端（用于发送消息） */
    get wsClient() {
      return wsClientRef.current;
    },
  };
};

export default useFileWatcher;
