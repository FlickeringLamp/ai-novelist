import { useEffect, useState } from 'react';
import './App.css';
import LayoutComponent from './components/LayoutComponent';
import EditorPanel from './components/editor/EditorPanel';
import ChatPanel from './components/chat/ChatPanel';
import ChapterTreePanel from './components/chapter/ChapterTreePanel';
import tabStateService from './services/tabStateService';
import httpClient from './utils/httpClient';

function App() {
  const [state, setState] = useState(tabStateService.getState());

  useEffect(() => {
    const handleStateChange = (event) => {
      setState(event.detail);
    };

    tabStateService.addEventListener('stateChanged', handleStateChange);

    return () => {
      tabStateService.removeEventListener('stateChanged', handleStateChange);
    };
  }, []);

  // 添加快捷键监听器
  useEffect(() => {
    const handleKeyDown = (event) => {
      // Ctrl+S 保存编辑器内容
      if (event.ctrlKey && event.key === 's') {
        event.preventDefault();
        
        const activeTab = state.openTabs.find(tab => tab.id === state.activeTabId);
        
        if (activeTab && activeTab.isDirty) {
          console.log('[App] Ctrl+S pressed - 保存编辑器内容:', activeTab.title);
          console.log('[App] 使用HTTP服务保存文件');
          httpClient.put(`/api/file/update/${encodeURIComponent(activeTab.id)}`, {
            content: activeTab.content
          })
            .then(() => {
              console.log('[App] 文件保存成功');
              tabStateService.updateTabContent(activeTab.id, activeTab.content, false);
            })
            .catch(error => {
              console.error('[App] 保存文件时发生错误:', error);
            });
        } else {
          console.log('[App] Ctrl+S pressed - 没有需要保存的内容');
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [state.openTabs, state.activeTabId]);

  return (
    <div className="App">
      <LayoutComponent
        chapterPanel={<ChapterTreePanel />}
        editorPanel={<EditorPanel />}
        chatPanel={<ChatPanel />}
      />
    </div>
  );
}

export default App;
