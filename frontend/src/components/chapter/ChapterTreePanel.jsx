import { useEffect, useState } from 'react';
import './ChapterTreePanel.css';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faGear, faFolder, faFile, faPlus } from '@fortawesome/free-solid-svg-icons';
import CombinedIcon from '../others/CombinedIcon';
import ContextMenu from './ContextMenu.jsx';
import UnifiedModal from '../others/UnifiedModal';
import httpClient from '../../utils/httpClient.js';
import renderChapterTree from './TreeRender.jsx';
import { useDispatch, useSelector } from 'react-redux'
import { addTab, setActiveTab } from '../../store/file_editor.js';


function ChapterTreePanel() {
  //@ts-ignore
  const tab = useSelector((state)=>state.file_editor.tabId)
  //@ts-ignore
  const activeTabId = useSelector((state)=>state.file_editor.activeTabId)
  const dispatch = useDispatch()
  //@ts-ignore
  const [chapters, setChapters] = useState([]); // 整个章节列表
  const [operateState, setOperateState] = useState(null); // 操作状态: 'selected' | 'copying' | 'cutting' | 'renaming' | null
  const [collapsedChapters, setCollapsedChapters] = useState({}); // 管理文件夹展开/折叠状态，不存在或false应该为关闭
  const [modal, setModal] = useState({
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

  // 获取章节列表
  const fetchChapters = async () => {
    try {
      const result = await httpClient.get('/api/file/tree');
      setChapters(result || []);
    } catch (error) {
      console.error('获取章节列表失败：', error);
      setModal({ show: true, message: error.toString() });
    }
  };
  // 注册章节更新监听器和初始加载
  useEffect(() => {
    fetchChapters();
  }, []);

  // 用来调出，关闭右键菜单的函数。
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
  // 确认删除
  const handleConfirmDelete = async () => {
    if (!contextMenu.itemId) return;
    
    setModal({ show: false, message: '' });
    try {
      await httpClient.delete(`/api/file/delete/${contextMenu.itemId}`);
      await fetchChapters();
    } catch (error) {
      console.error('删除失败:', error);
      setModal({ show: true, message: error.toString() });
    }
  };

  // 文件操作处理函数
  const handleDeleteItem = async (itemId) => {
    setModal({
      show: true,
      message: `确定要删除 "${itemId}" 吗？`
    });
  };

  // 统一的新建函数
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
      setModal({ show: true, message: error.toString() });
    }
  };

  const handlePaste = async (targetFolderId) => {
    if (!operateState) return;
    
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
      setModal({ show: true, message: error.toString() });
    }
  };

  const handleRenameItem = () => {
    const newItemName = prompt('请输入新名称:', contextMenu.itemTitle);
    if (newItemName && newItemName !== contextMenu.itemTitle) {
      const oldPath = contextMenu.itemId;
      const newPath = contextMenu.itemParentPath
        ? `${contextMenu.itemParentPath}/${newItemName}`
        : newItemName;
      
      httpClient.post('/api/file/move', {
        source_path: oldPath,
        target_path: newPath
      }).then(() => {
        handleCloseContextMenu();
        fetchChapters();
      }).catch(error => {
        console.error('重命名失败:', error);
        setModal({ show: true, message: error.toString() });
      });
    }
  };

  const handleChapterClick = (fileId) => {
    dispatch(addTab(fileId.id));
    dispatch(setActiveTab(fileId.id))
    console.log("当前总标签页：",tab,"，当前活跃标签页：",activeTabId)
  }


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
              {renderChapterTree(chapters, 0, {
                handleContextMenu,
                handleChapterClick,
                collapsedChapters
              })}
            </ul>
          )}
        </div>
      </div>

      {/* 右键菜单 */}
      <ContextMenu
        contextMenu={contextMenu}
        setContextMenu={setContextMenu}
        operateState={operateState}
        setOperateState={setOperateState}
        handleCreateItem={handleCreateItem}
        handleDeleteItem={handleDeleteItem}
        handlePaste={handlePaste}
        handleRenameItem={handleRenameItem}
      />

      {/* 设置按钮区域 */}
      <div className="settings-button-area">
        <button className="settings-button" title="设置">
          <FontAwesomeIcon icon={faGear} />
        </button>
      </div>

      {/* 模态框管理模块 */}
      {modal.show && (
        <UnifiedModal
          message={modal.message}
          showCancelButton={true}
          onConfirm={() => {
            if (modal.message.startsWith('确定要删除')) {
              handleConfirmDelete();
            } else {
              setModal({ show: false, message: '' });
            }
          }}
          onCancel={() => setModal({ show: false, message: '' })}
        />
      )}

    </div>
  );
}

export default ChapterTreePanel;
