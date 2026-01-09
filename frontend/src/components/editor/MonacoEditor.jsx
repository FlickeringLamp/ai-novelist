import React, { forwardRef, useCallback, useEffect, useRef, useState } from 'react';
import Editor from '@monaco-editor/react';
import { DiffEditor } from '@monaco-editor/react';
import loader from '@monaco-editor/loader';
import tabStateService from '../../services/tabStateService';
import httpClient from '../../utils/httpClient.js';

// 配置 Monaco Editor 使用本地资源
loader.config({
  paths: {
    vs: 'http://127.0.0.1:8000/static/monaco/vs'
  }
});

// 编辑器生命周期管理器
class EditorLifecycleManager {
  constructor() {
    this.editorInstances = new Map();
  }

  registerEditor(tabId, editorInstance) {
    this.editorInstances.set(tabId, editorInstance);
  }

  unregisterEditor(tabId) {
    const instance = this.editorInstances.get(tabId);
    if (instance) {
      try {
        if (instance.dispose) {
          instance.dispose();
        }
      } catch (error) {
        console.warn(`销毁编辑器实例失败 for tab ${tabId}:`, error);
      }
      this.editorInstances.delete(tabId);
    }
  }

  getEditorInstance(tabId) {
    return this.editorInstances.get(tabId) || null;
  }
}

const editorLifecycleManager = new EditorLifecycleManager();

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

// 基础 Monaco 编辑器组件
const MonacoEditor = forwardRef(({
  value = '',
  onChange,
  onInstanceReady = null
}, ref) => {
  const editorRef = useRef(null);

  const handleEditorDidMount = (editor) => {
    if (onInstanceReady) {
      onInstanceReady(editor);
    }
  };

  React.useImperativeHandle(ref, () => ({
    getValue: () => editorRef.current?.getValue() || '',
    setValue: (content) => editorRef.current?.setValue(content),
    insertValue: (content) => {
      const editor = editorRef.current;
      if (editor) {
        const position = editor.getPosition();
        editor.executeEdits('', [{
          range: {
            startLineNumber: position.lineNumber,
            startColumn: position.column,
            endLineNumber: position.lineNumber,
            endColumn: position.column,
          },
          text: content,
        }]);
      }
    },
    focus: () => editorRef.current?.focus(),
    getHTML: () => '',
    getText: () => editorRef.current?.getValue()?.replace(/[#*`\[\]()_~]/g, '').replace(/\n+/g, ' ').trim() || '',
    destroy: () => editorRef.current?.dispose(),
    getMonacoInstance: () => editorRef.current,
  }));

  return (
    <Editor
      height="100%"
      defaultLanguage="markdown"
      language="markdown"
      theme="vs-dark"
      value={value}
      onChange={onChange}
      onMount={(editor) => {
        editorRef.current = editor;
        handleEditorDidMount(editor);
      }}
      options={{
        minimap: { enabled: false },
        fontSize: 14,
        lineNumbers: 'on',
        wordWrap: 'on',
        automaticLayout: true,
        scrollBeyondLastLine: false,
        tabSize: 2,
      }}
    />
  );
});

// Diff 查看器组件
const MonacoDiffViewer = ({ originalContent, currentContent }) => {
  return (
    <div className="diff-viewer-container">
      <DiffEditor
        height="100%"
        language="markdown"
        theme="vs-dark"
        original={originalContent || ''}
        modified={currentContent || ''}
        options={{
          readOnly: true,
          minimap: { enabled: false },
          fontSize: 14,
          lineNumbers: 'on',
          wordWrap: 'on',
          automaticLayout: true,
          scrollBeyondLastLine: false,
          tabSize: 2,
          enableSplitViewResizing: true,
          renderSideBySide: true,
        }}
      />
    </div>
  );
};

// 保存确认弹窗组件
const SaveConfirmationModal = ({ 
  message, 
  onSave, 
  onDiscard, 
  onCancel 
}) => {
  const saveButtonRef = useRef(null);
  const discardButtonRef = useRef(null);
  const cancelButtonRef = useRef(null);
  const [focusedButton, setFocusedButton] = useState('save');

  useEffect(() => {
    if (focusedButton === 'save') {
      saveButtonRef.current?.focus();
    } else if (focusedButton === 'discard') {
      discardButtonRef.current?.focus();
    } else {
      cancelButtonRef.current?.focus();
    }
  }, [focusedButton]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        setFocusedButton((prev) => {
          if (prev === 'save') return 'cancel';
          if (prev === 'discard') return 'save';
          if (prev === 'cancel') return 'discard';
          return prev;
        });
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        setFocusedButton((prev) => {
          if (prev === 'save') return 'discard';
          if (prev === 'discard') return 'cancel';
          if (prev === 'cancel') return 'save';
          return prev;
        });
      } else if (event.key === 'Enter') {
        event.preventDefault();
        if (focusedButton === 'save') {
          onSave();
        } else if (focusedButton === 'discard') {
          onDiscard();
        } else {
          onCancel();
        }
      } else if (event.key === 'Escape') {
        event.preventDefault();
        onCancel();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [focusedButton, onSave, onDiscard, onCancel]);

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <p>{message}</p>
        <div className="modal-actions">
          <button
            ref={saveButtonRef}
            onClick={onSave}
            className={focusedButton === 'save' ? 'focused' : ''}
            tabIndex={0}
          >
            保存
          </button>
          <button
            ref={discardButtonRef}
            onClick={onDiscard}
            className={focusedButton === 'discard' ? 'focused' : ''}
            tabIndex={0}
          >
            丢弃
          </button>
          <button
            ref={cancelButtonRef}
            onClick={onCancel}
            className={focusedButton === 'cancel' ? 'focused' : ''}
            tabIndex={0}
          >
            取消
          </button>
        </div>
      </div>
    </div>
  );
};

// 标签栏组件
const TabBar = () => {
  const [openTabs, setOpenTabs] = useState(tabStateService.getOpenTabs());
  const [activeTabId, setActiveTabId] = useState(tabStateService.getActiveTabId());
  const [draggedTab, setDraggedTab] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);
  const [showSaveConfirm, setShowSaveConfirm] = useState(false);
  const [pendingTabId, setPendingTabId] = useState(null);

  useEffect(() => {
    const handleStateChange = (event) => {
      setOpenTabs(event.detail.openTabs);
      setActiveTabId(event.detail.activeTabId);
    };

    tabStateService.addEventListener('stateChanged', handleStateChange);

    return () => {
      tabStateService.removeEventListener('stateChanged', handleStateChange);
    };
  }, []);

  const handleTabClick = (tabId) => {
    tabStateService.setActiveTab(tabId);
  };

  const handleCloseTab = (e, tabId) => {
    e.stopPropagation();
    
    const tab = openTabs.find(t => t.id === tabId);
    
    if (tab && tab.isDirty) {
      setPendingTabId(tabId);
      setShowSaveConfirm(true);
    } else {
      closeTabInternal(tabId);
    }
  };

  const closeTabInternal = (tabId) => {
    editorLifecycleManager.unregisterEditor(tabId);
    tabStateService.closeTab(tabId);
  };

  const handleSaveConfirm = async () => {
    if (pendingTabId) {
      const tab = openTabs.find(t => t.id === pendingTabId);
      if (tab) {
        try {
          await httpClient.put(`/api/file/update/${encodeURIComponent(tab.id)}`, {
            content: tab.content
          });
          tabStateService.updateTabContent(pendingTabId, tab.content, false);
        } catch (error) {
          console.error('保存文件失败:', error);
        }
      }
      closeTabInternal(pendingTabId);
    }
    setShowSaveConfirm(false);
    setPendingTabId(null);
  };

  const handleDiscardConfirm = () => {
    if (pendingTabId) {
      closeTabInternal(pendingTabId);
    }
    setShowSaveConfirm(false);
    setPendingTabId(null);
  };

  const handleCancelConfirm = () => {
    setShowSaveConfirm(false);
    setPendingTabId(null);
  };

  const handleDragStart = (e, tabId, index) => {
    setDraggedTab({ id: tabId, index });
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', tabId);
    e.currentTarget.classList.add('dragging');
  };

  const handleDragEnd = (e) => {
    setDraggedTab(null);
    setDragOverIndex(null);
    
    const tabItems = document.querySelectorAll('.tab-item');
    tabItems.forEach(tab => {
      tab.classList.remove('dragging', 'drag-over-left', 'drag-over-right');
    });
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    
    if (draggedTab && draggedTab.index !== index) {
      setDragOverIndex(index);
      
      const tabItems = document.querySelectorAll('.tab-item');
      tabItems.forEach(tab => tab.classList.remove('drag-over-left', 'drag-over-right'));
      
      const rect = e.currentTarget.getBoundingClientRect();
      const mouseX = e.clientX;
      const centerX = rect.left + rect.width / 2;
      
      if (mouseX < centerX) {
        e.currentTarget.classList.add('drag-over-left');
      } else {
        e.currentTarget.classList.add('drag-over-right');
      }
    }
  };

  const handleDrop = (e, toIndex) => {
    e.preventDefault();
    
    if (draggedTab && draggedTab.index !== toIndex) {
      const rect = e.currentTarget.getBoundingClientRect();
      const mouseX = e.clientX;
      const centerX = rect.left + rect.width / 2;
      
      let finalToIndex = toIndex;
      if (mouseX < centerX && draggedTab.index > toIndex) {
        finalToIndex = toIndex;
      } else if (mouseX >= centerX && draggedTab.index < toIndex) {
        finalToIndex = toIndex + 1;
      } else if (draggedTab.index < toIndex) {
        finalToIndex = toIndex;
      } else {
        finalToIndex = toIndex;
      }
      
      tabStateService.reorderTabs(draggedTab.index, finalToIndex);
    }
    
    setDraggedTab(null);
    setDragOverIndex(null);
    
    const tabItems = document.querySelectorAll('.tab-item');
    tabItems.forEach(tab => {
      tab.classList.remove('dragging', 'drag-over-left', 'drag-over-right');
    });
  };

  const handleDragLeave = (e) => {
    e.currentTarget.classList.remove('drag-over-left', 'drag-over-right');
  };

  if (openTabs.length === 0) {
    return null;
  }

  return (
    <>
      <div className="tab-bar">
        {openTabs.map((tab, index) => (
          <div
            key={tab.id}
            className={`tab-item ${tab.id === activeTabId ? 'active' : ''} ${tab.isDeleted ? 'deleted' : ''}`}
            onClick={() => handleTabClick(tab.id)}
            draggable
            onDragStart={(e) => handleDragStart(e, tab.id, index)}
            onDragEnd={handleDragEnd}
            onDragOver={(e) => handleDragOver(e, index)}
            onDrop={(e) => handleDrop(e, index)}
            onDragLeave={handleDragLeave}
          >
            <span className="tab-title">{getDisplayName(tab.title)}</span>
            {tab.isDeleted && <span className="deleted-indicator">🗑️</span>}
            <button
              className={`close-tab-button ${tab.isDirty ? 'dirty-dot' : ''}`}
              onClick={(e) => handleCloseTab(e, tab.id)}
            >
              {tab.isDirty ? '•' : '×'}
            </button>
          </div>
        ))}
      </div>
      
      {showSaveConfirm && (
        <SaveConfirmationModal
          message="文件有未保存的更改，是否保存？"
          onSave={handleSaveConfirm}
          onDiscard={handleDiscardConfirm}
          onCancel={handleCancelConfirm}
        />
      )}
    </>
  );
};

// 主编辑器面板组件
function EditorPanel() {
  const [openTabs, setOpenTabs] = useState(tabStateService.getOpenTabs());
  const [activeTabId, setActiveTabId] = useState(tabStateService.getActiveTabId());
  const [title, setTitle] = useState('未命名');
  const [showModal, setShowModal] = useState(false);
  const [modalMessage, setModalMessage] = useState('');
  const [isTitleEditing, setIsTitleEditing] = useState(false);
  const titleInputRef = useRef(null);

  useEffect(() => {
    const handleStateChange = (event) => {
      setOpenTabs(event.detail.openTabs);
      setActiveTabId(event.detail.activeTabId);
    };

    tabStateService.addEventListener('stateChanged', handleStateChange);

    return () => {
      tabStateService.removeEventListener('stateChanged', handleStateChange);
    };
  }, []);

  const activeTab = openTabs.find(tab => tab.id === activeTabId);

  const getCurrentEditorInstance = useCallback(() => {
    if (!activeTab) return null;
    return editorLifecycleManager.getEditorInstance(activeTab.id);
  }, [activeTab]);

  const handleEditorChange = useCallback((newContent) => {
    if (!activeTab) return;
    
    const isContentChanged = newContent !== activeTab.content;
    
    tabStateService.updateTabContent(activeTab.id, newContent, isContentChanged);

    if (window.electron) {
        window.electron.setUnsavedChanges(isContentChanged);
    }
  }, [activeTab?.id, activeTab?.content]);

  const registerEditorInstance = useCallback((tabId, editorInstance) => {
    if (tabId && editorInstance) {
      editorLifecycleManager.registerEditor(tabId, editorInstance);
    }
  }, []);

  const unregisterEditorInstance = useCallback((tabId) => {
    if (tabId) {
      editorLifecycleManager.unregisterEditor(tabId);
    }
  }, []);

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

  useEffect(() => {
    if (window.electron && activeTab) {
      window.electron.setUnsavedChanges(activeTab.isDirty);
    }
  }, [activeTab?.isDirty]);

  useEffect(() => {
    if (activeTab) {
      setTitle(getDisplayName(activeTab.title));
    } else {
      setTitle('未命名');
    }
  }, [activeTab?.id, activeTab?.title]);

  return (
    <>
      <TabBar />
      {!activeTab ? (
        <div className="no-file-selected-panel">
          <div className="no-file-message">
            <p>没有打开的文件</p>
          </div>
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
              <MonacoDiffViewer
                originalContent={typeof activeTab.content === 'string' ? activeTab.content : (activeTab.content?.content || '')}
                currentContent={typeof activeTab.suggestedContent === 'string' ? activeTab.suggestedContent : (activeTab.suggestedContent?.content || '')}
              />
            </div>
          ) : (
            <>
              <div className="editor-container">
                <MonacoEditor
                  key={activeTab.id}
                  value={typeof activeTab.content === 'string' ? activeTab.content : (activeTab.content?.content || '')}
                  onChange={handleEditorChange}
                  placeholder="开始编写您的内容..."
                  onInstanceReady={(instance) => registerEditorInstance(activeTab.id, instance)}
                />
              </div>
            </>
          )}
        </div>
      )}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <p>{modalMessage}</p>
            <div className="modal-actions">
              <button onClick={() => setShowModal(false)}>确定</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default EditorPanel;
