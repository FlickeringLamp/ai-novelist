import { useEffect, useCallback, useState } from 'react';
import './ChapterTreePanel.css';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faGear, faFolder, faFile, faRotate, faPlus } from '@fortawesome/free-solid-svg-icons';
import CombinedIcon from '../others/CombinedIcon';
import ContextMenuManager from './ContextMenuManager';
import ModalManager from '../others/ModalManager';
import httpClient from '../../utils/httpClient.js';
import PrefixEditManager from './PrefixEditManager';
import ChapterTreeRenderer from './ChapterTreeRenderer';
import tabStateService from '../../services/tabStateService';

function ChapterTreePanel() {
  const [chapters, setChapters] = useState([]);
  const [refreshCounter, setRefreshCounter] = useState(tabStateService.getRefreshCounter());
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [currentRenameItemId, setCurrentRenameItemId] = useState(null);
  const [currentRenameItemTitle, setCurrentRenameItemTitle] = useState('');
  const [collapsedChapters, setCollapsedChapters] = useState({});
  const [showNotificationModal, setShowNotificationModal] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState('');
  const [showConfirmationModal, setShowConfirmationModal] = useState(false);
  const [confirmationMessage, setConfirmationMessage] = useState('');
  const [onConfirmCallback, setOnConfirmCallback] = useState(null);
  const [onCancelCallback, setOnCancelCallback] = useState(null);

  // 前缀编辑状态
  const [editingPrefix, setEditingPrefix] = useState({
    itemId: null,
    prefix: '',
    isFolder: false,
    currentPath: ''
  });

  // 右键菜单状态
  const [contextMenu, setContextMenu] = useState({
    show: false,
    x: 0,
    y: 0,
    itemId: null,
    isFolder: false,
    itemTitle: null,
    itemParentPath: null
  });

  // 复制/剪切操作的临时存储
  const [copiedItem, setCopiedItem] = useState(null);
  const [cutItem, setCutItem] = useState(null);

  // 获取章节列表
  const fetchChapters = useCallback(async () => {
    try{
      const result = await httpClient.get('/api/file/tree');
      setChapters(result||[]);
      tabStateService.setChapters(result||[]);
    }catch(error){
      console.error('获取章节列表失败：',error)
      setNotificationMessage(error.toString());
      setShowNotificationModal(true);
    }
  }, []);

  // 辅助函数：根据文件名获取显示名称
  const getDisplayName = useCallback((name, isFolder) => {
    if (!name) return '';
    if (isFolder) {
      return name;
    }
    const lastDotIndex = name.lastIndexOf('.');
    return lastDotIndex !== -1 ? name.substring(0, lastDotIndex) : name;
  }, []);

  // 辅助函数：获取兄弟节点
  const getSiblingItems = useCallback((items, path) => {
    if (!path) return items;
    
    const findFolderByPath = (currentItems, targetPathParts, currentIndex) => {
      if (currentIndex === targetPathParts.length) {
        return currentItems;
      }
      const part = targetPathParts[currentIndex];
      const folder = currentItems.find(item => item.isFolder && item.title === part);
      if (folder && folder.children) {
        return findFolderByPath(folder.children, targetPathParts, currentIndex + 1);
      }
      return [];
    };

    const pathParts = path.split('/');
    return findFolderByPath(items, pathParts, 0);
  }, []);

  // 辅助函数：提取前缀
  const getDisplayPrefix = useCallback((item) => {
    return item.displayPrefix || '';
  }, []);

  // 前缀编辑处理函数
  const handlePrefixEdit = useCallback((itemId, currentPrefix, isFolder, currentPath) => {
    setEditingPrefix({
      itemId,
      prefix: currentPrefix,
      isFolder,
      currentPath
    });
  }, []);

  const handlePrefixEditCancel = useCallback(() => {
    setEditingPrefix({
      itemId: null,
      prefix: '',
      isFolder: false,
      currentPath: ''
    });
  }, []);

  // 注册章节更新监听器和初始加载
  useEffect(() => {
    fetchChapters();
  }, [fetchChapters]);

  // 监听 refreshCounter 变化
  useEffect(() => {
    const handleStateChange = (event) => {
      setRefreshCounter(event.detail.refreshCounter);
    };

    tabStateService.addEventListener('stateChanged', handleStateChange);

    return () => {
      tabStateService.removeEventListener('stateChanged', handleStateChange);
    };
  }, []);

  useEffect(() => {
    console.log('[ChapterTreePanel] refreshCounter 变化，触发 fetchChapters()');
    fetchChapters();
  }, [refreshCounter, fetchChapters]);
  // 章节点击处理
  const handleChapterClick = async (item) => {
    if (item.isFolder) {
      setCollapsedChapters(prev => ({
        ...prev,
        [item.id]: !prev[item.id]
      }));
    } else {
      console.log(`请求打开文件: ${item.id}`);
      const existingTab = tabStateService.getOpenTabs().find(tab => tab.id === item.id);
      if (existingTab) {
        tabStateService.setActiveTab(item.id);
      } else {
        try {
          const response = await httpClient.get(`/api/file/read/${encodeURIComponent(item.id)}`);
          tabStateService.createTab(item.id, response);
        } catch (error) {
          console.error('读取文件失败:', error);
        }
      }
    }
  };

  // 右键菜单处理
  const handleContextMenu = useCallback((event, itemId, isFolder, itemTitle, itemParentPath) => {
    event.preventDefault();
    setContextMenu({
      show: true,
      x: event.clientX,
      y: event.clientY,
      itemId: itemId,
      isFolder: isFolder,
      itemTitle: itemTitle,
      itemParentPath: itemParentPath,
    });
  }, []);

  const handleCloseContextMenu = useCallback(() => {
    setContextMenu({ ...contextMenu, show: false });
  }, [contextMenu]);

  // 文件操作处理函数
  const handleDeleteItem = useCallback(async (itemId) => {
    setConfirmationMessage(`确定要删除 "${itemId}" 吗？`);
    setOnConfirmCallback(() => async () => {
      setShowConfirmationModal(false);
      try {
        await httpClient.delete(`/api/file/delete/${itemId}`);
        await fetchChapters();
      } catch (error) {
        console.error('删除失败:', error);
        setNotificationMessage(error.toString());
        setShowNotificationModal(true);
      }
    });
    setOnCancelCallback(() => () => {
      setShowConfirmationModal(false);
    });
    setShowConfirmationModal(true);
  }, [fetchChapters]);

  const handleRenameConfirm = useCallback(async (oldItemId, newTitle) => {
    if (!newTitle || !newTitle.trim()) {
      setNotificationMessage('名称不能为空！');
      setShowNotificationModal(true);
      return;
    }

    const findItemInChapters = (items, idToFind) => {
      for (const item of items) {
        if (item.id === idToFind) {
          return item;
        }
        if (item.children) {
          const found = findItemInChapters(item.children, idToFind);
          if (found) return found;
        }
      }
      return null;
    };

    const originalItem = findItemInChapters(chapters, oldItemId);
    if (!originalItem) {
      console.error('未找到要重命名的项:', oldItemId);
      setNotificationMessage('重命名失败：原始项不存在。');
      setShowNotificationModal(true);
      return;
    }

    let finalNewTitle = newTitle.trim();

    if (!originalItem.isFolder) {
      const originalFileName = originalItem.name || originalItem.title;
      if (originalFileName) {
        const lastDotIndex = originalFileName.lastIndexOf('.');
        if (lastDotIndex !== -1) {
          const originalExtension = originalFileName.substring(lastDotIndex);
          if (!finalNewTitle.includes('.') && originalExtension) {
            finalNewTitle += originalExtension;
          }
        } else {
          if (!finalNewTitle.includes('.')) {
            finalNewTitle += '.md';
          }
        }
      } else {
        if (!finalNewTitle.includes('.')) {
          finalNewTitle += '.md';
        }
      }
    }

    try {
      await httpClient.post('/api/file/rename', {
        old_path: oldItemId,
        new_name: finalNewTitle
      });
      handleCloseContextMenu();
      await fetchChapters();
    } catch (error) {
      console.error('重命名失败:', error);
      setNotificationMessage(error.toString());
      setShowNotificationModal(true);
    }
  }, [chapters, handleCloseContextMenu, fetchChapters]);

  const handleRenameItem = useCallback((item) => {
    handleCloseContextMenu();
    setCurrentRenameItemId(item.id);
    setCurrentRenameItemTitle(getDisplayName(item.title, item.isFolder));
    setShowRenameModal(true);
  }, [handleCloseContextMenu, getDisplayName]);

  const handleRenameModalConfirm = useCallback(() => {
    if (currentRenameItemId && currentRenameItemTitle) {
      handleRenameConfirm(currentRenameItemId, currentRenameItemTitle);
      setShowRenameModal(false);
      setCurrentRenameItemId(null);
      setCurrentRenameItemTitle('');
    }
  }, [currentRenameItemId, currentRenameItemTitle, handleRenameConfirm]);

  const handleRenameModalCancel = useCallback(() => {
    setShowRenameModal(false);
    setCurrentRenameItemId(null);
    setCurrentRenameItemTitle('');
  }, []);

  const handleRenameInputChange = useCallback((e) => {
    setCurrentRenameItemTitle(e.target.value);
  }, []);

  // 新建文件
  const handleNewFile = useCallback(async (parentPath = '') => {
    const defaultTitle = '新建文件';
    const fileName = `${defaultTitle}.md`;
    try {
      await httpClient.post('/api/file/files', {
        name: fileName,
        content: '',
        parent_path: parentPath
      });
      handleCloseContextMenu();
      await fetchChapters();
    } catch (error) {
      console.error('新建文件失败:', error);
      setNotificationMessage(error.toString());
      setShowNotificationModal(true);
    }
  }, [handleCloseContextMenu, fetchChapters]);

  // 新建文件夹
  const handleNewFolder = useCallback(async (parentPath = '') => {
    const defaultFolderName = '新文件夹';
    try {
      await httpClient.post('/api/file/folders', {
        name: defaultFolderName,
        parent_path: parentPath
      });
      handleCloseContextMenu();
      await fetchChapters();
    } catch (error) {
      console.error('新建文件夹失败:', error);
      setNotificationMessage(error.toString());
      setShowNotificationModal(true);
    }
  }, [handleCloseContextMenu, fetchChapters]);

  const handleCopy = useCallback((itemId, isCut) => {
    if (isCut) {
      setCutItem({ id: itemId, isCut: true });
      setCopiedItem(null);
    } else {
      setCopiedItem({ id: itemId, isCut: false });
      setCutItem(null);
    }
    handleCloseContextMenu();
  }, [handleCloseContextMenu]);

  const handlePaste = useCallback(async (targetFolderId) => {
    try {
      if (cutItem) {
        await httpClient.post('/api/file/move', {
          source_path: cutItem.id,
          target_path: targetFolderId
        });
        setCutItem(null);
      } else if (copiedItem) {
        await httpClient.post('/api/file/copy', {
          source_path: copiedItem.id,
          target_path: targetFolderId
        });
        setCopiedItem(null);
      }
      handleCloseContextMenu();
      await fetchChapters();
    } catch (error) {
      console.error('粘贴失败:', error);
      setNotificationMessage(error.toString());
      setShowNotificationModal(true);
    }
  }, [cutItem, copiedItem, handleCloseContextMenu, fetchChapters]);

  const getCopyCutState = useCallback(() => {
    return {
      copiedItem: copiedItem,
      cutItem: cutItem
    };
  }, [copiedItem, cutItem]);

  // 使用模块管理器
  const prefixEditManager = PrefixEditManager({
    editingPrefix,
    chapters,
    onPrefixEdit: handlePrefixEdit,
    onPrefixEditCancel: handlePrefixEditCancel,
    getSiblingItems,
    setNotificationMessage,
    setShowNotificationModal,
    fetchChapters
  });


  return (
    <div className="chapter-tree-panel-container">
      <div className="chapter-tree-panel-header">
        <button className="new-file-button" onClick={() => handleNewFile()} title="新建文件">
          <CombinedIcon baseIcon={faFile} overlayIcon={faPlus} size="sm" />
        </button>
        <button className="new-folder-button" onClick={() => handleNewFolder()} title="新建文件夹">
          <CombinedIcon baseIcon={faFolder} overlayIcon={faPlus} size="sm" />
        </button>
        <button className="refresh-button" onClick={fetchChapters} title="刷新章节列表">
          <FontAwesomeIcon icon={faRotate} />
        </button>
      </div>

      <div className="main-chapter-area">
        <div className="chapter-tree-panel-content" onContextMenu={(e) => handleContextMenu(e, null, false, null, '')}>
          {chapters.length === 0 ? (
            <p className="no-chapters-message">暂无文件</p>
          ) : (
            <ChapterTreeRenderer
              items={chapters}
              collapsedChapters={collapsedChapters}
              getDisplayName={getDisplayName}
              getDisplayPrefix={getDisplayPrefix}
              handleChapterClick={handleChapterClick}
              handleContextMenu={handleContextMenu}
              renderPrefixEdit={prefixEditManager.renderPrefixEdit}
            />
          )}
        </div>
      </div>

      {/* 右键菜单管理模块 */}
      <ContextMenuManager
        contextMenu={contextMenu}
        copiedItem={getCopyCutState().copiedItem}
        cutItem={getCopyCutState().cutItem}
        onCloseContextMenu={handleCloseContextMenu}
        onNewFile={handleNewFile}
        onNewFolder={handleNewFolder}
        onCopy={handleCopy}
        onPaste={handlePaste}
        onRenameItem={handleRenameItem}
        onDeleteItem={handleDeleteItem}
      />

      {/* 设置按钮区域 */}
      <div className="settings-button-area">
        <button className="settings-button" title="设置">
          <FontAwesomeIcon icon={faGear} />
        </button>
      </div>

      {/* 模态框管理模块 */}
      <ModalManager
        showRenameModal={showRenameModal}
        currentRenameItemTitle={currentRenameItemTitle}
        onRenameInputChange={handleRenameInputChange}
        onRenameModalConfirm={handleRenameModalConfirm}
        onRenameModalCancel={handleRenameModalCancel}
        
        showNotificationModal={showNotificationModal}
        notificationMessage={notificationMessage}
        onNotificationClose={() => setShowNotificationModal(false)}
        
        showConfirmationModal={showConfirmationModal}
        confirmationMessage={confirmationMessage}
        onConfirmCallback={onConfirmCallback}
        onCancelCallback={onCancelCallback}
      />

    </div>
  );
}

export default ChapterTreePanel;
