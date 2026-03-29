import './App.css';
import { useEffect } from 'react';
import { useDispatch, useStore } from 'react-redux';
import { ThemeProvider } from './context/ThemeContext';
import LayoutComponent from './components/LayoutComponent';
import EditorPanel from './components/editor/EditorPanel';
import ChatPanel from './components/chat/ChatPanel';
import ChapterTreePanel from './components/chapter/ChapterTreePanel';
import wsClient from './utils/wsClient';
import { initFileWatcher } from './utils/fileTreeHelper';
import { initTabStateHandler } from './utils/tabStateHandler';
import type { EditorSliceRootState } from './types/store';

function App() {
  const dispatch = useDispatch();
  const store = useStore();

  useEffect(() => {
    // 初始化标签栏状态处理器
    initTabStateHandler(() => store.getState() as EditorSliceRootState);
    
    // 先注册回调（在连接前注册，onConnect 处理器内部会检查 if (this.isConnected)，如果已经连接会立即执行）
    const cleanupFileWatcher = initFileWatcher(dispatch);
    
    // 然后建立 WebSocket 连接
    wsClient.connect().catch((error: Error) => {
      console.error('[App] WebSocket 连接失败:', error);
    });

    return () => {
      cleanupFileWatcher();
      wsClient.disconnect();
    };
  }, [dispatch, store]);

  return (
    <ThemeProvider>
      <div className="bg-theme-black text-theme-white h-screen overflow-hidden flex flex-col">
        <LayoutComponent
          chapterPanel={<ChapterTreePanel />}
          editorPanel={<EditorPanel />}
          chatPanel={<ChatPanel />}
        />
      </div>
    </ThemeProvider>
  );
}

export default App;
