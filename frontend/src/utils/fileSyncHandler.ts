/**
 * 文件内容同步处理器
 *
 * 接收后端推送的文件内容更新，同步到编辑器状态
 * 只更新已打开的文件（存在于 currentData 中的）
 */

import wsClient from './wsClient';
import type { WSMessage } from '../types/websocket';
import type { EditorSliceRootState } from '../types/store';
import { updateTabContent, updateBackUp } from '../store/editor';

// 获取 store 的函数，将在初始化时注入
let getStoreState: (() => EditorSliceRootState) | null = null;
let dispatchFn: ((action: any) => void) | null = null;

/**
 * 初始化文件同步处理器
 * @param storeGetter 获取 Redux store 状态的函数
 * @param dispatch  Redux dispatch 函数
 */
export function initFileSyncHandler(
  storeGetter: () => EditorSliceRootState,
  dispatch: (action: any) => void,
): void {
  getStoreState = storeGetter;
  dispatchFn = dispatch;

  // 注册 WebSocket 消息处理器
  wsClient.onMessage(handleWebSocketMessage);

  console.log('[FileSyncHandler] 文件同步处理器已初始化');
}

/**
 * 处理 WebSocket 消息
 */
function handleWebSocketMessage(message: WSMessage): void {
  console.log('[DEBUG] 收到 WebSocket 消息:', message);
  
  if (message.type !== 'file_content_sync') {
    return;
  }

  if (!getStoreState || !dispatchFn) {
    console.warn('[FileSyncHandler] Store 未初始化');
    return;
  }

  const { path, content } = message.payload;
  console.log('[DEBUG] 解析 payload:', { path, content: content?.substring(0, 50), contentLength: content?.length });
  
  if (!path) {
    console.warn('[FileSyncHandler] 收到无效的文件同步消息');
    return;
  }

  try {
    // 获取当前状态
    const state = getStoreState();
    const { currentData } = state.tabSlice;
    
    console.log('[DEBUG] 当前打开的文件:', Object.keys(currentData));
    console.log('[DEBUG] 目标路径:', path, '是否存在:', path in currentData);

    // 只处理已打开的文件（存在于 currentData 中）
    if (!(path in currentData)) {
      console.log('[DEBUG] 文件未打开，忽略:', path);
      return;
    }

    // 检查内容是否变化
    const currentContent = currentData[path];
    console.log('[DEBUG] 当前内容长度:', currentContent?.length, '新内容长度:', content?.length);
    
    if (currentContent === content) {
      console.log('[DEBUG] 内容相同，无需更新');
      return;
    }

    // 同步更新 currentData 和 backUp
    console.log('[DEBUG] 调用 updateTabContent:', { id: path, content: content?.substring(0, 50) });
    dispatchFn(updateTabContent({ id: path, content }));
    dispatchFn(updateBackUp({ id: path, content }));

    console.log(`[FileSyncHandler] 文件已同步: ${path}`);
  } catch (error) {
    console.error('[FileSyncHandler] 同步文件内容失败:', error);
  }
}
