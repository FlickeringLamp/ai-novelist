import { useEffect, useState } from 'react';
import './ChapterTreePanel.css';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faGear, faFolder, faFile, faRotate, faPlus, faCaretRight, faCaretDown } from '@fortawesome/free-solid-svg-icons';
import CombinedIcon from '../others/CombinedIcon';
import ContextMenu from '../others/ContextMenu';
import ModalManager from '../others/ModalManager';
import httpClient from '../../utils/httpClient.js';
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
  const fetchChapters = async () => {
    try {
      const result = await httpClient.get('/api/file/tree');
      setChapters(result || []);
      tabStateService.setChapters(result || []);
    } catch (error) {
      console.error('获取章节列表失败：', error);
      setNotificationMessage(error.toString());
      setShowNotificationModal(true);
    }
  };

  // 辅助函数：根据文件名获取显示名称
  const getDisplayName = (name, isFolder) => {
    if (!name) return '';
    if (isFolder) {
      return name;
    }
    const lastDotIndex = name.lastIndexOf('.');
    return lastDotIndex !== -1 ? name.substring(0, lastDotIndex) : name;
  };

  // 注册章节更新监听器和初始加载
  useEffect(() => {
    fetchChapters();
  }, []);

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
  }, [refreshCounter]);

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

  const handleCloseContextMenu = () => {
    setContextMenu({ ...contextMenu, show: false });
  };

  // 文件操作处理函数
  const handleDeleteItem = async (itemId) => {
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
  };

  const handleRenameConfirm = async (oldItemId, newTitle) => {
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
  };

  const handleRenameItem = (item) => {
    handleCloseContextMenu();
    setCurrentRenameItemId(item.id);
    setCurrentRenameItemTitle(getDisplayName(item.title, item.isFolder));
    setShowRenameModal(true);
  };

  const handleRenameModalConfirm = () => {
    if (currentRenameItemId && currentRenameItemTitle) {
      handleRenameConfirm(currentRenameItemId, currentRenameItemTitle);
      setShowRenameModal(false);
      setCurrentRenameItemId(null);
      setCurrentRenameItemTitle('');
    }
  };

  const handleRenameModalCancel = () => {
    setShowRenameModal(false);
    setCurrentRenameItemId(null);
    setCurrentRenameItemTitle('');
  };

  const handleRenameInputChange = (e) => {
    setCurrentRenameItemTitle(e.target.value);
  };

  // 统一的创建项目函数
  const handleCreateItem = async (name, isFolder, parentPath = '') => {
    try {
      await httpClient.post('/api/file/items', {
        name,
        content: '',
        parent_path: parentPath,
        is_folder: isFolder
      });
      handleCloseContextMenu();
      await fetchChapters();
    } catch (error) {
      console.error('创建失败:', error);
      setNotificationMessage(error.toString());
      setShowNotificationModal(true);
    }
  };

  // 新建文件
  const handleNewFile = async (parentPath = '') => {
    await handleCreateItem('新建文件.md', false, parentPath);
  };

  // 新建文件夹
  const handleNewFolder = async (parentPath = '') => {
    await handleCreateItem('新文件夹', true, parentPath);
  };

  const handleCopy = (itemId, isCut) => {
    if (isCut) {
      setCutItem({ id: itemId, isCut: true });
      setCopiedItem(null);
    } else {
      setCopiedItem({ id: itemId, isCut: false });
      setCutItem(null);
    }
    handleCloseContextMenu();
  };

  const handlePaste = async (targetFolderId) => {
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
  };

  // 渲染章节树
  const renderChapterTree = (items, level = 0) => {
    return items.map(item => {
      const itemId = item.id || item.path || '';
      const itemTitle = item.title || item.name || '';
      const isFolder = item.isFolder || item.type === 'folder';
      const hasChildren = item.children && item.children.length > 0;
      const displayName = getDisplayName(itemTitle, isFolder);

      return (
        <li
          key={itemId}
          className={`chapter-list-item ${isFolder ? 'folder-item' : 'file-item'} level-${level}`}
        >
          <div
            className={`chapter-item-content ${isFolder && level > 0 ? 'nested-folder-content' : ''}`}
            style={{ paddingLeft: `${level * 20}px` }}
            onContextMenu={(e) => {
              e.stopPropagation();
              const parentPath = isFolder ? itemId : (itemId.includes('/') ? itemId.substring(0, itemId.lastIndexOf('/')) : '');

              handleContextMenu(e, itemId, isFolder, itemTitle, parentPath);
            }}
          >
            {isFolder && (
              <span onClick={() => handleChapterClick(item)} className="collapse-icon">
                <FontAwesomeIcon icon={collapsedChapters[itemId] ? faCaretRight : faCaretDown} />
              </span>
            )}

            {/* 文件/文件夹图标 */}
            <FontAwesomeIcon icon={isFolder ? faFolder : faFile} className="folder-file-icon" />

            {/* 文件/文件夹名称 */}
            <button
              onClick={() => handleChapterClick(item)}
              className="chapter-title-button"
            >
              {displayName}
            </button>
          </div>

          {isFolder && hasChildren && !collapsedChapters[itemId] && (
            <ul className="sub-chapter-list">
              {renderChapterTree(item.children, level + 1)}
            </ul>
          )}
        </li>
      );
    });
  };
  // 构建右键菜单项
  const getContextMenuItems = () => {
    const items = [];
    const isItemSelected = contextMenu.itemId !== null &&
                          contextMenu.itemId !== undefined &&
                          contextMenu.itemId !== '';
    const canPaste = copiedItem || cutItem;

    if (isItemSelected) {
      const isFolder = contextMenu.isFolder;
      const targetPath = isFolder ? contextMenu.itemId : contextMenu.itemParentPath;

      items.push(
        { label: '复制', onClick: () => handleCopy(contextMenu.itemId, false) },
        { label: '剪切', onClick: () => handleCopy(contextMenu.itemId, true) },
        { label: '重命名', onClick: () => handleRenameItem({
          id: contextMenu.itemId,
          title: contextMenu.itemTitle
        }) },
        { label: '删除', onClick: () => handleDeleteItem(contextMenu.itemId) }
      );

      if (isFolder && canPaste) {
        items.push({ label: '粘贴', onClick: () => handlePaste(contextMenu.itemId) });
      }

      if (isFolder) {
        items.push(
          { label: '新建文件', onClick: () => handleNewFile(contextMenu.itemId) },
          { label: '新建文件夹', onClick: () => handleNewFolder(contextMenu.itemId) }
        );
      }
    } else {
      items.push(
        { label: '新建文件', onClick: () => handleNewFile('') },
        { label: '新建文件夹', onClick: () => handleNewFolder('') }
      );
      if (canPaste) {
        items.push({ label: '粘贴', onClick: () => handlePaste('') });
      }
    }

    return items;
  };

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
