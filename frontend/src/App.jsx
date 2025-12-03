import React, { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import './App.css';
import LayoutComponent from './components/LayoutComponent';
import EditorPanel from './components/editor/EditorPanel';
import ChatPanel from './components/chat/ChatPanel';
import ChapterTreePanel from './components/chapter/ChapterTreePanel';
import { registerWebSocketListeners } from './services/websocketListener'; // 导入新的 WebSocket 处理模块
import websocketClient from './services/websocketClient'; // 导入 WebSocket 客户端
import { setNovelContent, setCurrentFile, triggerChapterRefresh } from './store/slices/novelSlice';
import useHttpService from './hooks/useHttpService';

function App() {
  const dispatch = useDispatch();
  const { openTabs, activeTabId } = useSelector((state) => state.novel);

  const { getStoreValue, invoke } = useHttpService();

  // 添加快捷键监听器
  useEffect(() => {
    const handleKeyDown = (event) => {
      // Ctrl+S 保存编辑器内容
      if (event.ctrlKey && event.key === 's') {
        event.preventDefault(); // 阻止浏览器默认保存行为
        
        // 获取当前活动标签页
        const activeTab = openTabs.find(tab => tab.id === activeTabId);
        
        if (activeTab && activeTab.isDirty) {
          console.log('[App] Ctrl+S pressed - 保存编辑器内容:', activeTab.title);
          
          // 使用HTTP服务保存文件
          console.log('[App] 使用HTTP服务保存文件');
          invoke('save-novel-content', activeTab.id, activeTab.content)
            .then(result => {
              if (result.success) {
                console.log('[App] 文件保存成功');
                // 更新标签页状态为已保存
                dispatch({
                  type: 'novel/updateTabContent',
                  payload: {
                    tabId: activeTab.id,
                    content: activeTab.content,
                    isDirty: false
                  }
                });
              } else {
                console.error('[App] 文件保存失败:', result.error);
              }
            })
            .catch(error => {
              console.error('[App] 保存文件时发生错误:', error);
            });
        } else {
          console.log('[App] Ctrl+S pressed - 没有需要保存的内容');
        }
      }
      
      // Ctrl+Shift+I 或 F12 切换开发者工具
      if ((event.ctrlKey && event.shiftKey && event.key === 'I') || event.key === 'F12') {
        event.preventDefault();
        // 开发者工具功能在浏览器环境中不可用
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [openTabs, activeTabId, invoke, dispatch]);

  useEffect(() => {
    const cleanupListeners = registerWebSocketListeners(dispatch); // 注册 WebSocket 监听器

    // 启动 WebSocket 连接
    console.log('[App] 启动 WebSocket 连接');
    websocketClient.connect();

    // 项目启动时加载所有设置
    const loadAppSettings = async () => {
      try {
        console.log('[App] 开始从存储加载设置...');
        const results = await Promise.all([
          getStoreValue('selectedModel'),
          getStoreValue('selectedProvider'),
          getStoreValue('deepseekApiKey'),
          getStoreValue('openrouterApiKey'),
          getStoreValue('aliyunEmbeddingApiKey'),
          getStoreValue('intentAnalysisModel'),
          getStoreValue('enableStream'),
          getStoreValue('customProviders')
        ]);

        // 提取实际的值
        // 提取实际的值（getStoreValue现在直接返回值，不再返回嵌套对象）
        const storedSelectedModel = results[0] !== null && results[0] !== undefined ? results[0] : null;
        const storedSelectedProvider = results[1] !== null && results[1] !== undefined ? results[1] : null;
        const storedDeepseekApiKey = results[2] !== null && results[2] !== undefined ? results[2] : null;
        const storedOpenrouterApiKey = results[3] !== null && results[3] !== undefined ? results[3] : null;
        const storedAliyunEmbeddingApiKey = results[4] !== null && results[4] !== undefined ? results[4] : null;
        const storedIntentAnalysisModel = results[5] !== null && results[5] !== undefined ? results[5] : null;
        const storedEnableStream = results[6] !== null && results[6] !== undefined ? results[6] : null;
        const storedCustomProviders = results[7] !== null && results[7] !== undefined ? results[7] : null;

        // 加载其他设置
        console.log(`[App] 从存储加载的selectedModel: "${storedSelectedModel}"`);
        console.log(`[App] 从存储加载的selectedProvider: "${storedSelectedProvider}"`);

        console.log('[App] 设置加载完成');
      } catch (error) {
        console.error('[App] 加载设置失败:', error);
      }
    };

    loadAppSettings();

    return () => {
      cleanupListeners(); // 清理监听器
    };
  }, [dispatch, getStoreValue]); // 依赖 dispatch 和 getStoreValue

  return (
    <div className="App">
      <LayoutComponent
        chapterPanel={<ChapterTreePanel />}
        editorPanel={<EditorPanel />}
        chatPanel={<ChatPanel />} // ChatPanel 不再需要传递 props，它会通过 useSelector 获取
      />
    </div>
  );
}

export default App;
