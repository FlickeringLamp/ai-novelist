/**
 * 标签栏状态 WebSocket 处理器
 * 
 * 处理后端请求，返回当前标签栏状态
 * 在应用启动时注册到 wsClient
 */

import wsClient from './wsClient';
import type { WSMessage } from '../types/websocket';
import type { EditorSliceRootState } from '../types/store';

// 获取 store 的函数，将在初始化时注入
let getStoreState: (() => EditorSliceRootState) | null = null;

/**
 * 初始化标签栏状态处理器
 * @param storeGetter 获取 Redux store 状态的函数
 */
export function initTabStateHandler(storeGetter: () => EditorSliceRootState): void {
  getStoreState = storeGetter;
  
  // 注册 WebSocket 消息处理器
  wsClient.onMessage(handleWebSocketMessage);
  
  console.log('[TabStateHandler] 标签栏状态处理器已初始化');
}

/**
 * 处理 WebSocket 消息
 */
function handleWebSocketMessage(message: WSMessage): void {
  if (message.type !== 'request_tab_state') {
    return;
  }
  
  if (!getStoreState) {
    console.warn('[TabStateHandler] Store 未初始化');
    return;
  }
  
  try {
    // 获取当前标签栏状态
    const state = getStoreState();
    const { tabBars, activeTabBarId } = state.tabSlice;
    
    // 发送响应
    wsClient.send('tab_state_response', {
      tabBars,
      activeTabBarId
    });
    
    console.log('[TabStateHandler] 标签栏状态已发送');
  } catch (error) {
    console.error('[TabStateHandler] 获取标签栏状态失败:', error);
  }
}
