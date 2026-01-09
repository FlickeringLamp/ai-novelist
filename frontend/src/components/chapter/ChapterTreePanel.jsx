import { useEffect, useState } from 'react';
import './ChapterTreePanel.css';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faGear, faFolder, faFile, faPlus, faCaretRight, faCaretDown } from '@fortawesome/free-solid-svg-icons';
import CombinedIcon from '../others/CombinedIcon';
import ContextMenu from './ContextMenu.jsx';
import ModalManager from '../others/ModalManager';
import httpClient from '../../utils/httpClient.js';
import tabStateService from '../../services/tabStateService';

function ChapterTreePanel() {
  const [chapters, setChapters] = useState([]);
  const [operateState, setOperateState] = useState(null); // 操作状态: 'selected' | 'copying' | 'cutting' | 'renaming' | null
  const [collapsedChapters, setCollapsedChapters] = useState({}); // 管理文件夹展开/折叠状态，不存在或false应该为关闭
  const [notificationModal, setNotificationModal] = useState({
    show: false,
    message: ''
  });
  const [confirmationModal, setConfirmationModal] = useState({
    show: false,
    message: ''
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

  // 右键菜单处理
  const handleContextMenu = (event, itemId, isFolder, itemTitle, itemParentPath) => {
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
  };

  // 由return里的{contextMenu.show &&...}检测show的ture值，控制右键菜单开启

  // 构建右键菜单项
  const getContextMenuItems = () => {
    const items = [];
    const isItemSelected = contextMenu.itemId !== null && contextMenu.itemId !== undefined;
    const canPaste = operateState;

    if (isItemSelected) {
      const isFolder = contextMenu.isFolder;

      items.push(
        { label: '复制', onClick: () => { setOperateState('copying'); handleCloseContextMenu(); } },
        { label: '剪切', onClick: () => { setOperateState('cutting'); handleCloseContextMenu(); } },
        { label: '重命名', onClick: () => handleRenameItem() }, // 重命名操作自己会关菜单
        { label: '删除', onClick: () => handleDeleteItem(contextMenu.itemId) }
      );
      if (isFolder && canPaste) {
        items.push({ label: '粘贴', onClick: () => handlePaste(contextMenu.itemId) });
      }

      if (isFolder) {
        items.push(
          { label: '新建文件', onClick: () => handleCreateItem(false, contextMenu.itemId) },
          { label: '新建文件夹', onClick: () => handleCreateItem(true, contextMenu.itemId) }
        );
      }
    } else {
      items.push(
        { label: '新建文件', onClick: () => handleCreateItem(false, '') },
        { label: '新建文件夹', onClick: () => handleCreateItem(true, '') }
      );
      if (canPaste) {
        items.push({ label: '粘贴', onClick: () => handlePaste('') });
      }
    }

    return items;
  };

  // 获取章节列表
  const fetchChapters = async () => {
    try {
      const result = await httpClient.get('/api/file/tree');
      setChapters(result || []);
      tabStateService.setChapters(result || []);
    } catch (error) {
      console.error('获取章节列表失败：', error);
      setNotificationModal({ show: true, message: error.toString() });
    }
  };
  // 注册章节更新监听器和初始加载
  useEffect(() => {
    fetchChapters();
  }, []);

  // 监听刷新计数器变化，重新获取章节列表
  useEffect(() => {
    const handleStateChange = (event) => {
      const refreshCounter = event.detail.refreshCounter;
      // 当 refreshCounter 变化时，重新获取章节列表
      if (refreshCounter > 0) {
        fetchChapters();
      }
    };

    tabStateService.addEventListener('stateChanged', handleStateChange);

    return () => {
      tabStateService.removeEventListener('stateChanged', handleStateChange);
    };
  }, []);

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

  const handleCloseContextMenu = () => {
    setContextMenu({ ...contextMenu, show: false });
  };

  // 文件操作处理函数
  // 确认删除
  const handleConfirmDelete = async () => {
    if (!contextMenu.itemId) return;
    
    setConfirmationModal(prev => ({ ...prev, show: false }));
    try {
      await httpClient.delete(`/api/file/delete/${contextMenu.itemId}`);
      await fetchChapters();
    } catch (error) {
      console.error('删除失败:', error);
      setNotificationModal({ show: true, message: error.toString() });
    }
  };
  // 取消删除
  const handleCancelDelete = () => {
    setConfirmationModal(prev => ({ ...prev, show: false }));
  };

  // 文件操作处理函数
  const handleDeleteItem = async (itemId) => {
    setConfirmationModal({
      show: true,
      message: `确定要删除 "${itemId}" 吗？`
    });
  };
  const handleRenameItem = () => {
    handleCloseContextMenu();
    setOperateState('renaming');
  };

  // 统一的创建项目函数
  const handleCreateItem = async (isFolder, parentPath = '') => {
    try {
      await httpClient.post('/api/file/items', {
        parent_path: parentPath,
        is_folder: isFolder
      });
      handleCloseContextMenu();
      await fetchChapters();
    } catch (error) {
      console.error('创建失败:', error);
      setNotificationModal({ show: true, message: error.toString() });
    }
  };

  const handlePaste = async (targetFolderId) => {
    if (!operateState || !contextMenu.itemId) return;
    
    try {
      if (operateState === 'cutting') {
        await httpClient.post('/api/file/move', {
          source_path: contextMenu.itemId,
          target_path: targetFolderId
        });
      } else if (operateState === 'copying') {
        await httpClient.post('/api/file/copy', {
          source_path: contextMenu.itemId,
          target_path: targetFolderId
        });
      }
      setOperateState(null);
      handleCloseContextMenu();
      await fetchChapters();
    } catch (error) {
      console.error('粘贴失败:', error);
      setNotificationModal({ show: true, message: error.toString() });
    }
  };


  return (
    <div className="chapter-tree-panel-container">
      <div className="chapter-tree-panel-header">
        <button className="new-file-button" onClick={() => handleCreateItem(false)} title="新建文件">
          <CombinedIcon baseIcon={faFile} overlayIcon={faPlus} size="sm" />
        </button>
        <button className="new-folder-button" onClick={() => handleCreateItem(true)} title="新建文件夹">
          <CombinedIcon baseIcon={faFolder} overlayIcon={faPlus} size="sm" />
        </button>
      </div>

      <div className="main-chapter-area">
        <div className="chapter-tree-panel-content" onContextMenu={(e) => handleContextMenu(e, null, false, null, '')}>
          {chapters.length === 0 ? (
            <p className="no-chapters-message">暂无文件</p>
          ) : (
            <ul className="chapter-list">
              {renderChapterTree(chapters)}
            </ul>
          )}
        </div>
      </div>

      {/* 右键菜单 */}
      {contextMenu.show && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={getContextMenuItems()}
          onClose={handleCloseContextMenu}
        />
      )}

      {/* 设置按钮区域 */}
      <div className="settings-button-area">
        <button className="settings-button" title="设置">
          <FontAwesomeIcon icon={faGear} />
        </button>
      </div>

      {/* 模态框管理模块 */}
      <ModalManager
        showNotificationModal={notificationModal.show}
        notificationMessage={notificationModal.message}
        onNotificationClose={() => setNotificationModal({ ...notificationModal, show: false })}

        showConfirmationModal={confirmationModal.show}
        confirmationMessage={confirmationModal.message}
        onConfirm={handleConfirmDelete}
        onCancel={handleCancelDelete}
      />

    </div>
  );
}

export default ChapterTreePanel;
