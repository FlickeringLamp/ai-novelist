import React, { useCallback, useEffect, useRef, useState } from 'react';
import VditorEditor from './VditorEditor.jsx';
import DiffViewer from './DiffViewer.jsx';
import ContextMenu from '../others/ContextMenu.jsx';
import { vditorLifecycleManager } from './services/VditorLifecycleManager.js';
import SplitViewPanel from './SplitViewPanel';
import TabBar from './TabBar';

import './EditorPanel.css';
import NotificationModal from '../others/NotificationModal.jsx';
import BackgroundImage from './BackgroundImage.jsx';

import { useCharacterCount } from './services/CharacterCountService.js';
import { useContextMenu } from './hooks/useContextMenu.js';
import tabStateService from '../../services/tabStateService';
import httpClient from '../../utils/httpClient.js';

// 辅助函数：获取不带扩展名的显示名称
const getDisplayName = (fileName) => {
  if (!fileName) return '未命名';
  const lastDotIndex = fileName.lastIndexOf('.');
  return lastDotIndex !== -1 ? fileName.substring(0, lastDotIndex) : fileName;
};

// 辅助函数：获取文件扩展名
const getFileExtension = (fileName) => {
  if (!fileName) return '.md';
  const lastDotIndex = fileName.lastIndexOf('.');
  return lastDotIndex !== -1 ? fileName.substring(lastDotIndex) : '.md';
};

function EditorPanel({ splitViewTabId = null }) {
  const [openTabs, setOpenTabs] = useState(tabStateService.getOpenTabs());
  const [activeTabId, setActiveTabId] = useState(tabStateService.getActiveTabId());
  const [splitView, setSplitView] = useState(tabStateService.getSplitView());

  useEffect(() => {
    const handleStateChange = (event) => {
      setOpenTabs(event.detail.openTabs);
      setActiveTabId(event.detail.activeTabId);
      setSplitView(event.detail.splitView);
    };

    tabStateService.addEventListener('stateChanged', handleStateChange);

    return () => {
      tabStateService.removeEventListener('stateChanged', handleStateChange);
    };
  }, []);

  const displayTabId = splitViewTabId || activeTabId;
  const activeTab = openTabs.find(tab => tab.id === displayTabId);

  const titleInputRef = useRef(null);
  
  // 状态管理
  const [title, setTitle] = useState('未命名');
  const [characterCount, setCharacterCount] = useState(0);
  const [showModal, setShowModal] = useState(false);
  const [modalMessage, setModalMessage] = useState('');
  const [isTitleEditing, setIsTitleEditing] = useState(false);

  // 使用服务模块
  const { calculateCharacterCount, getCharacterCountFromEditor } = useCharacterCount();

  // 获取当前标签页的编辑器实例
  const getCurrentEditorInstance = useCallback(() => {
    if (!activeTab) return null;
    return vditorLifecycleManager.getEditorInstance(activeTab.id);
  }, [activeTab]);

  // 定义函数
  const handleEditorChange = useCallback((newContent) => {
    if (!activeTab) return;
    
    const isContentChanged = newContent !== activeTab.content;
    
    tabStateService.updateTabContent(activeTab.id, newContent, isContentChanged);

    const contentToCount = newContent || '';
    setCharacterCount(calculateCharacterCount(contentToCount));

    if (window.electron) {
        window.electron.setUnsavedChanges(isContentChanged);
    }
  }, [activeTab?.id, activeTab?.content, calculateCharacterCount]);
  // 注册编辑器实例
  const registerEditorInstance = useCallback((tabId, editorInstance) => {
    if (tabId && editorInstance) {
      vditorLifecycleManager.registerEditor(tabId, editorInstance);
      
      // 在编辑器实例注册后，立即更新字符统计
      setTimeout(() => {
        const count = getCharacterCountFromEditor(editorInstance);
        if (count > 0) {
          setCharacterCount(count);
        }
      }, 100);
    }
  }, [getCharacterCountFromEditor]);

  // 注销编辑器实例
  const unregisterEditorInstance = useCallback((tabId) => {
    if (tabId) {
      vditorLifecycleManager.unregisterEditor(tabId);
    }
  }, []);

  // 初始化字符计数
  useEffect(() => {
    if (activeTab) {
      // 确保content是有效的字符串，处理可能的对象格式
      let content = '';
      if (typeof activeTab.content === 'string') {
        content = activeTab.content;
      } else if (activeTab.content && typeof activeTab.content === 'object') {
        content = activeTab.content.content || '';
      }
      setCharacterCount(calculateCharacterCount(content));
    } else {
      setCharacterCount(0);
    }
  }, [activeTab?.id, activeTab?.content, calculateCharacterCount, setCharacterCount]);

  // 简化的标题管理
  const handleTitleSave = useCallback(async () => {
    if (!activeTab || !title.trim()) return;
    
    const oldFilePath = activeTab.id;
    const newTitle = title.trim();
    
    const originalExtension = getFileExtension(oldFilePath);
    const fullFileName = newTitle.includes('.') ? newTitle : newTitle + originalExtension;
    if (newTitle !== getDisplayName(activeTab.title)) {
      try {
        await httpClient.post('/api/file/rename', {
          old_path: oldFilePath,
          new_name: fullFileName
        });
        tabStateService.fileRenamed(oldFilePath, fullFileName);
      } catch (error) {
        console.error('重命名失败:', error);
      }
    }
    
    setIsTitleEditing(false);
  }, [activeTab, title]);
  const handleTitleKeyDown = useCallback((e) => {
    if (e.key === 'Enter') {
      handleTitleSave();
    } else if (e.key === 'Escape') {
      setTitle(getDisplayName(activeTab?.title) || '未命名');
      setIsTitleEditing(false);
    }
  }, [handleTitleSave, activeTab]);

  const handleTitleFocus = useCallback(() => {
    setIsTitleEditing(true);
  }, []);

  const {
    showContextMenu,
    contextMenuPos,
    handleContextMenu,
    handleCloseContextMenu
  } = useContextMenu();


  // Effect for updating the 'isDirty' status in the main process
  useEffect(() => {
    if (window.electron && activeTab) {
      window.electron.setUnsavedChanges(activeTab.isDirty);
    }
  }, [activeTab?.isDirty]);

  // 初始化标题
  useEffect(() => {
    if (activeTab) {
      // 显示不带扩展名的标题
      setTitle(getDisplayName(activeTab.title));
    } else {
      setTitle('未命名');
    }
  }, [activeTab?.id, activeTab?.title]);

  // 如果是分屏模式，渲染 SplitViewPanel
  if (splitView.enabled && splitViewTabId === null) {
    return <SplitViewPanel />;
  }

  return (
    <>
      {!splitView.enabled && <TabBar />}
      {!activeTab ? (
        <div className="no-file-selected-panel">
          <BackgroundImage />
        </div>
      ) : (
        <div className="editor-panel-content">
          <div className="title-bar">
            {activeTab.isDeleted ? (
              <div className="deleted-file-indicator">
                <span className="deleted-icon">🗑️</span>
                <span className="deleted-text">{title} (已删除)</span>
              </div>
            ) : (
              <>
                <input
                  type="text"
                  ref={titleInputRef}
                  className="novel-title-input"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  onFocus={handleTitleFocus}
                  onBlur={handleTitleSave}
                  onKeyDown={handleTitleKeyDown}
                />
              </>
            )}
          </div>

          {activeTab.isDeleted ? (
            <div className="deleted-file-message">
              <p>此文件已被删除，无法编辑。</p>
              <p>请关闭此标签页或切换到其他文件。</p>
            </div>
          ) : activeTab.viewMode === 'diff' ? (
            <div className="diff-view-wrapper">
              <DiffViewer
                originalContent={typeof activeTab.content === 'string' ? activeTab.content : (activeTab.content?.content || '')}
                currentContent={typeof activeTab.suggestedContent === 'string' ? activeTab.suggestedContent : (activeTab.suggestedContent?.content || '')}
              />
            </div>
          ) : (
            <>
              <div className="editor-container">
                <VditorEditor
                  key={activeTab.id} // 使用 key 强制重新创建编辑器实例
                  value={typeof activeTab.content === 'string' ? activeTab.content : (activeTab.content?.content || '')}
                  onChange={handleEditorChange}
                  placeholder="开始编写您的内容..."
                  onInstanceReady={(instance) => registerEditorInstance(activeTab.id, instance)}
                />
              </div>
              {/* 字符统计显示 - 移动到编辑框外的右下角 */}
              <div className="character-count-container">
                <div className="character-count">
                  总字符数: {characterCount}
                </div>
              </div>
            </>
          )}
        </div>
      )}
      {showModal && (
        <NotificationModal message={modalMessage} onClose={() => setShowModal(false)} />
      )}
    </>
  );
}


export default EditorPanel;
