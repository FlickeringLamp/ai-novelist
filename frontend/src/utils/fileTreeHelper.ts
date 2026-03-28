import { useDispatch } from 'react-redux';
import { setChapters } from '../store/file.ts';
import { getWSClient } from './wsClient.ts';

const WS_URL = 'ws://localhost:8000/ws';

/**
 * 初始化 WebSocket 文件监控
 * 在应用启动时调用一次，订阅后后端会自动推送初始文件树和后续变化
 */
export const initFileWatcher = (dispatch: ReturnType<typeof useDispatch>) => {
  const wsClient = getWSClient(WS_URL);

  // 监听文件树更新
  const unsubscribeMessage = wsClient.onMessage((message) => {
    if (message.type === 'file_tree_update') {
      dispatch(setChapters(message.payload.tree || []));
    }
  });

  // 连接成功后订阅文件变化（订阅时自动返回初始文件树）
  const unsubscribeConnect = wsClient.onConnect(() => {
    wsClient.send('subscribe_file_changes', {});
  });

  // 返回清理函数
  return () => {
    unsubscribeMessage();
    unsubscribeConnect();
  };
};
