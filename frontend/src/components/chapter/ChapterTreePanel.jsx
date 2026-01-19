import { useEffect, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faGear, faFolder, faFile, faFolderOpen } from '@fortawesome/free-solid-svg-icons';
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
  const [lastSelectedItem, setLastSelectedItem] = useState({
    state: null, // 'copying' | 'cutting' | null
    id: null,
    isFolder: false,
    itemTitle: null,
    itemParentPath: null
  }); // 保存复制/剪切的源项目信息
  const [collapsedChapters, setCollapsedChapters] = useState({}); // 管理文件夹展开/折叠状态，不存在或false应该为关闭
  const [modal, setModal] = useState({
    show: false,
    message: '',
    onConfirm: null
  });
  // 右键菜单状态
  const [contextMenu, setContextMenu] = useState({
    show: false,
    x: 0,
    y: 0
  });
  // 选中的项目状态
  const [selectedItem, setSelectedItem] = useState({
    state: null, // 'selected' | 'copying' | 'cutting' | 'renaming' | null
    id: null,
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
      setModal({ show: true, message: error.toString(), onConfirm: null });
    }
  };
  // 注册章节更新监听器和初始加载
  useEffect(() => {
    fetchChapters();
  }, []);
  // 用来调出，关闭右键菜单的函数。
  const handleContextMenu = (event, itemId, isFolder, itemTitle, itemParentPath) => {
    event.preventDefault();
    setSelectedItem({
      state: 'selected',
      id: itemId,
      isFolder: isFolder,
      itemTitle: itemTitle,
      itemParentPath: itemParentPath
    });
    setContextMenu({
      show: true,
      x: event.clientX,
      y: event.clientY
    });
  };
  const handleCloseContextMenu = () => {
    setContextMenu({
      show: false,
      x: 0,
      y: 0
    })
  };


  // 确认删除
  const handleConfirmDelete = async () => {
    try {
      setModal({ show: false, message: "", onConfirm: null });
      await httpClient.delete(`/api/file/delete/${selectedItem.id}`);
      setSelectedItem({
        state: null,
        id: null,
        isFolder: false,
        itemTitle: null,
        itemParentPath: null
      });
      handleCloseContextMenu();
      await fetchChapters();
    } catch (error) {
      setModal({show: false, message: "", onConfirm: null })
      console.error('删除失败:', error);
      setModal({ show: true, message: error.toString(), onConfirm: null });
    }
  };
  // 文件操作处理函数
  const handleDeleteItem = async (itemId) => {
    setModal({
      show: true,
      message: `确定要删除 "${itemId}" 吗？`,
      onConfirm: handleConfirmDelete
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
      setModal({ show: true, message: error.toString(), onConfirm: null });
    }
  };
  const handlePaste = async (targetFolderId) => {
    if (!lastSelectedItem.state) return;

    try {
      if (lastSelectedItem.state === 'cutting') {
        await httpClient.post('/api/file/move', {
          source_path: lastSelectedItem.id,
          target_path: targetFolderId
        });
      } else if (lastSelectedItem.state === 'copying') {
        await httpClient.post('/api/file/copy', {
          source_path: lastSelectedItem.id,
          target_path: targetFolderId
        });
      }
      setLastSelectedItem({
        state: null,
        id: null,
        isFolder: false,
        itemTitle: null,
        itemParentPath: null
      });
      handleCloseContextMenu();
      await fetchChapters();
    } catch (error) {
      console.error('粘贴失败:', error);
      setModal({ show: true, message: error.toString(), onConfirm: null });
    }
  };
  const handleRenameItem = () => {
    const newItemName = prompt('请输入新名称:', selectedItem.itemTitle);
    if (newItemName && newItemName !== selectedItem.itemTitle) {
      const oldPath = selectedItem.id;
      const newPath = selectedItem.itemParentPath
        ? `${selectedItem.itemParentPath}/${newItemName}`
        : newItemName;

      httpClient.post('/api/file/move', {
        source_path: oldPath,
        target_path: newPath
      }).then(() => {
        setSelectedItem({
          state: null,
          id: null,
          isFolder: false,
          itemTitle: null,
          itemParentPath: null
        });
        handleCloseContextMenu();
        fetchChapters();
      }).catch(error => {
        console.error('重命名失败:', error);
        setModal({ show: true, message: error.toString(), onConfirm: null });
      });
    } else {
      // 用户取消重命名或输入相同名称时，清除选中状态
      setSelectedItem({
        state: null,
        id: null,
        isFolder: false,
        itemTitle: null,
        itemParentPath: null
      });
      handleCloseContextMenu();
    }
  };
  const handleChapterClick = (fileId) => {
    dispatch(addTab(fileId.id));
    dispatch(setActiveTab(fileId.id))
    console.log("当前总标签页：",tab,"，当前活跃标签页：",activeTabId)
  }

  const handleToggleCollapse = (itemId) => {
    setCollapsedChapters(prev => ({
      ...prev,
      [itemId]: !prev[itemId]
    }));
  }

  const handleCollapseAll = () => {
    setCollapsedChapters({});
  }

  // 按钮样式
  const commonBtnStyle = "text-theme-white border border-theme-gray1 p-2 rounded-small cursor-pointer text-base flex items-center gap-1 hover:border-theme-green hover:text-theme-green";


  return (
    <div className="bg-theme-black text-theme-gray2 flex flex-col h-full">
      <div className="flex justify-center gap-2.5 border-b border-theme-gray3 h-[5%] flex-shrink-0 items-center bg-theme-gray1 w-full">
        <button className={commonBtnStyle} onClick={() => handleCreateItem(false)} title="新建文件">
          <FontAwesomeIcon icon={faFile} />
        </button>
        <button className={commonBtnStyle} onClick={() => handleCreateItem(true)} title="新建文件夹">
          <FontAwesomeIcon icon={faFolder} />
        </button>
        <button className={commonBtnStyle} onClick={handleCollapseAll} title="折叠所有">
          <FontAwesomeIcon icon={faFolderOpen} />
        </button>
      </div>

      <div className="flex flex-col h-[90%] flex-shrink-0 bg-theme-gray1 w-full">
        <div className="flex-grow overflow-y-auto p-2.5" onContextMenu={(e) => handleContextMenu(e, null, false, null, '')}>
          {chapters.length === 0 ? (
            <p className="p-2.5 text-center text-theme-green">暂无文件</p>
          ) : (
            <ul className="list-none p-0 m-0">
              {renderChapterTree(chapters, 0, {
                handleContextMenu,
                handleChapterClick,
                handleToggleCollapse,
                collapsedChapters,
                selectedItem
              })}
            </ul>
          )}
        </div>
      </div>
      {/* 右键菜单 */}
      <ContextMenu
        contextMenu={contextMenu}
        selectedItem={selectedItem}
        setSelectedItem={setSelectedItem}
        lastSelectedItem={lastSelectedItem}
        setLastSelectedItem={setLastSelectedItem}
        handleCloseContextMenu={handleCloseContextMenu}
        handleCreateItem={handleCreateItem}
        handleDeleteItem={handleDeleteItem}
        handlePaste={handlePaste}
        handleRenameItem={handleRenameItem}
      />

      {/* 设置按钮区域 */}
      <div className="h-[5%] flex-shrink-0 flex justify-end items-end p-2.5 bg-theme-gray1 w-full border-t border-theme-gray3">
        <button className="bg-transparent text-theme-white border-none p-0 rounded-0 text-lg cursor-pointer flex items-center justify-center transition-colors hover:bg-transparent hover:border-transparent hover:text-theme-green" title="设置">
          <FontAwesomeIcon icon={faGear} />
        </button>
      </div>

      {/* 模态框管理模块 */}
      {modal.show && (
        <UnifiedModal
          message={modal.message}
          onConfirm={modal.onConfirm || (() => setModal({ show: false, message: '', onConfirm: null }))}
          onCancel={() => setModal({ show: false, message: '', onConfirm: null })}
        />
      )}

    </div>
  );
}

export default ChapterTreePanel;