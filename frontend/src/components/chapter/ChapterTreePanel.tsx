import { useEffect, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faGear, faFolder, faFile, faFolderOpen, faRotate } from '@fortawesome/free-solid-svg-icons';
import { useDispatch, useSelector } from 'react-redux';
import { updateTabId } from '../../store/editor.ts';
import { collapseAll } from '../../store/file.ts';
import type { RootState } from '../../types';
import ChapterContextMenu from './FileContextMenu.tsx';
import UnifiedModal from '../others/UnifiedModal';
import httpClient from '../../utils/httpClient.ts';
import ChapterTreeItem from './TreeRender.tsx';
import CreateInput from './CreateInput.tsx';
import { ThemeSettingsPanel } from '../theme';
function ChapterTreePanel() {
  const dispatch = useDispatch();
  const chapters = useSelector((state: RootState) => state.fileSlice.chapters);
  /*
   * 以下是两个item状态的思路
   * 首先，文件操作分为三类：
   * 1. 一个对象的操作，比如新建，删除，重命名
   * 2. 需要两个对象的操作，比如复制粘贴，剪切粘贴
   * 3. 特殊状态：选中，这个状态主要出现在右键项目后，具体操作完成前，用于强调被选中的文件，呈现更加醒目的视觉效果
   * 单对象操作，只用selectedItem即可，两对象操作，需要读取lastSelectedItem和selectedItem的状态
   */
  const [selectedItem, setSelectedItem] = useState<{ state: string | null; id: string | null; isFolder: boolean; itemTitle: string | null; itemParentPath: string | null }>({
    state: null, // 'selected' | 'renaming' | 'creating' | null
    id: null,
    isFolder: false,
    itemTitle: null,
    itemParentPath: null
  });
  const [lastSelectedItem, setLastSelectedItem] = useState<{ state: string | null; id: string | null; isFolder: boolean; itemTitle: string | null; itemParentPath: string | null }>({
    state: null, // 'copying' | 'cutting' | null
    id: null,
    isFolder: false,
    itemTitle: null,
    itemParentPath: null
  });
  // 创建新文件/文件夹的状态
  const [creatingItem, setCreatingItem] = useState<{
    isCreating: boolean;
    isFolder: boolean;
    parentPath: string;
  }>({
    isCreating: false,
    isFolder: false,
    parentPath: ''
  });
  // 消息模态框状态
  const [modal, setModal] = useState<{ show: boolean; message: string; onConfirm: (() => void) | null; onCancel: (() => void) | null }>({
    show: false,
    message: '',
    onConfirm: null,
    onCancel: null
  });
  // 右键菜单状态
  const [contextMenu, setContextMenu] = useState({
    show: false,
    x: 0,
    y: 0
  });

  // 主题设置弹窗状态
  const [showThemeSettings, setShowThemeSettings] = useState(false);

  // 拖拽相关状态
  const [draggedItemId, setDraggedItemId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);

  // 看看每次的数据长啥样
  useEffect(()=>{
    console.log("选中的项目信息",selectedItem)
    console.log("上一个被选中的项目信息",lastSelectedItem)
  },[selectedItem,lastSelectedItem])


  const handleContextMenu = (event: React.MouseEvent, itemId: string, isFolder: boolean, itemTitle: string, itemParentPath: string) => {
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

  // 新建 - 显示输入框让用户输入名称
  const handleCreateItem = (isFolder: boolean, parentPath: string = '') => {
    handleCloseContextMenu();
    setCreatingItem({
      isCreating: true,
      isFolder,
      parentPath
    });
  };

  // 实际创建文件/文件夹
  const handleConfirmCreate = async (name: string) => {
    if (!name || name.trim() === '') {
      // 名称为空，取消创建
      setCreatingItem({ isCreating: false, isFolder: false, parentPath: '' });
      return;
    }

    try {
      const result = await httpClient.post('/api/file/items', {
        parent_path: creatingItem.parentPath,
        is_folder: creatingItem.isFolder,
        name: name.trim()
      });

      // 重置创建状态
      setCreatingItem({ isCreating: false, isFolder: false, parentPath: '' });

      // 自动选中刚创建的文件/文件夹
      if (result && result.id) {
        setSelectedItem({
          state: 'selected',
          id: result.id,
          isFolder: creatingItem.isFolder,
          itemTitle: result.title,
          itemParentPath: creatingItem.parentPath
        });
      }
    } catch (error) {
      console.error('创建失败:', error);
      setModal({ show: true, message: (error as Error).toString(), onConfirm: null, onCancel: null });
      setCreatingItem({ isCreating: false, isFolder: false, parentPath: '' });
    }
  };

  // 取消创建
  const handleCancelCreate = () => {
    setCreatingItem({ isCreating: false, isFolder: false, parentPath: '' });
  };

  // 处理移动文件/文件夹
  const handleMoveItem = async (sourcePath: string, targetPath: string) => {
    try {
      // 获取源路径的父路径
      const sourceParentPath = sourcePath.includes('/')
        ? sourcePath.substring(0, sourcePath.lastIndexOf('/'))
        : '';

      // 如果拖到自己的父路径，无需移动
      if (sourceParentPath === targetPath) {
        return;
      }

      // 计算目标路径（如果是文件夹，则是 folder/sourceName；如果是根目录，则是 sourceName）
      const sourceName = sourcePath.includes('/')
        ? sourcePath.substring(sourcePath.lastIndexOf('/') + 1)
        : sourcePath;
      const finalTargetPath = targetPath
        ? `${targetPath}/${sourceName}`
        : sourceName;

      await httpClient.post('/api/file/move', {
        source_path: sourcePath,
        target_path: targetPath
      });

      // 更新所有标签栏中的标签 id
      dispatch(updateTabId({ oldId: sourcePath, newId: finalTargetPath }));
    } catch (error) {
      console.error('移动失败:', error);
      setModal({
        show: true,
        message: '移动失败: ' + (error as Error).toString(),
        onConfirm: () => setModal({ show: false, message: '', onConfirm: null, onCancel: null }),
        onCancel: null
      });
    }
  };

  // 处理根目录的拖放（拖放到空白区域或根目录）
  const handleRootDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (draggedItemId) {
      // 设置拖放效果为"移动"
      e.dataTransfer.dropEffect = 'move';
      setDropTargetId('');
    }
  };

  const handleRootDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    // 检查是否真的离开了容器
    const rect = (e.currentTarget as Element).getBoundingClientRect(); // 获取元素在屏幕上的位置/大小，返回上下左右距离屏幕边框的距离，元素本身的宽高
    const x = e.clientX;
    const y = e.clientY; // .clientX/Y是获取鼠标在屏幕的位置。

    if (x < rect.left || x >= rect.right || y < rect.top || y >= rect.bottom) {
      setDropTargetId(null);
    }
  };

  const handleRootDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const sourcePath = e.dataTransfer.getData('text/plain'); // 在TreeRender里面存的，现在取出来
    if (!sourcePath) return;

    setDropTargetId(null);

    // 拖放到根目录
    await handleMoveItem(sourcePath, '');
  };

  // 按钮样式
  const commonBtnStyle = "text-theme-white border border-theme-gray1 p-2 rounded-small cursor-pointer text-base flex items-center gap-1 hover:border-theme-green hover:text-theme-green";


  return (
    <div className="bg-theme-black text-theme-gray2 flex flex-col h-full">
      <div className="flex justify-center gap-2.5 border-b border-theme-gray3 h-[5%] flex-shrink-0 items-center bg-theme-gray1 w-full">
        <button
          className={commonBtnStyle}
          onClick={() => {
            // 如果选中的是文件夹，在该文件夹下创建；否则在根目录创建
            const parentPath = selectedItem.state === 'selected' && selectedItem.isFolder && selectedItem.id
              ? selectedItem.id
              : '';
            handleCreateItem(false, parentPath);
          }}
          title="新建文件"
        >
          <FontAwesomeIcon icon={faFile} />
        </button>
        <button
          className={commonBtnStyle}
          onClick={() => {
            // 如果选中的是文件夹，在该文件夹下创建；否则在根目录创建
            const parentPath = selectedItem.state === 'selected' && selectedItem.isFolder && selectedItem.id
              ? selectedItem.id
              : '';
            handleCreateItem(true, parentPath);
          }}
          title="新建文件夹"
        >
          <FontAwesomeIcon icon={faFolder} />
        </button>
        <button className={commonBtnStyle} onClick={() => dispatch(collapseAll())} title="折叠所有">
          <FontAwesomeIcon icon={faFolderOpen} />
        </button>
      </div>

      <div className="flex flex-col h-[90%] flex-shrink-0 bg-theme-gray1 w-full">
        <div 
          className={`flex-grow overflow-y-auto p-2.5 ${dropTargetId === '' ? 'ring-2 ring-theme-green ring-inset' : ''}`}
          onContextMenu={(e) => handleContextMenu(e, '', false, '', '')}
          onDragOver={handleRootDragOver}
          onDragLeave={handleRootDragLeave}
          onDrop={handleRootDrop}
        >
          {(chapters.length === 0 && !creatingItem.isCreating) ? (
            <p className="p-2.5 text-center text-theme-green">暂无文件</p>
          ) : (
            <ul className="list-none p-0 m-0">
              {creatingItem.isCreating && creatingItem.parentPath === '' && (
                <li className="chapter-list-item">
                  <div
                    className="chapter-item-content flex cursor-pointer text-theme-green bg-theme-gray2"
                    style={{ paddingLeft: '0px' }}
                  >
                    <CreateInput
                      isFolder={creatingItem.isFolder}
                      onConfirm={handleConfirmCreate}
                      onCancel={handleCancelCreate}
                    />
                  </div>
                </li>
              )}
              {chapters.map(item => (
                <ChapterTreeItem
                  key={item.id}
                  item={item}
                  level={0}
                  creatingItem={creatingItem}
                  onConfirmCreate={handleConfirmCreate}
                  onCancelCreate={handleCancelCreate}
                  props={{
                    handleContextMenu,
                    selectedItem,
                    lastSelectedItem,
                    setSelectedItem,
                    setModal,
                    // 拖拽相关
                    draggedItemId,
                    setDraggedItemId,
                    dropTargetId,
                    setDropTargetId,
                    handleMoveItem
                  }}
                />
              ))}
            </ul>
          )}
        </div>
      </div>
      {/* 右键菜单 */}
      <ChapterContextMenu
        contextMenu={contextMenu}
        selectedItem={selectedItem}
        setSelectedItem={setSelectedItem}
        lastSelectedItem={lastSelectedItem}
        setLastSelectedItem={setLastSelectedItem}
        handleCloseContextMenu={handleCloseContextMenu}
        handleCreateItem={handleCreateItem}
        setModal={setModal}
      />

      {/* 设置按钮区域 */}
      <div className="h-[5%] flex-shrink-0 flex justify-end items-end p-2.5 bg-theme-gray1 w-full border-t border-theme-gray3">
        <button 
          onClick={() => setShowThemeSettings(true)}
          className="bg-transparent text-theme-white border-none p-0 rounded-0 text-lg cursor-pointer flex items-center justify-center transition-colors hover:bg-transparent hover:border-transparent hover:text-theme-green" 
          title="主题色设置"
        >
          <FontAwesomeIcon icon={faGear} />
        </button>
      </div>

      {/* 主题设置弹窗 */}
      {showThemeSettings && (
        <div className="fixed inset-0 z-[100] bg-black/50 flex items-center justify-center">
          <div className="w-[90%] max-w-md h-[80%] bg-theme-black rounded-lg shadow-2xl overflow-hidden">
            <ThemeSettingsPanel onClose={() => setShowThemeSettings(false)} />
          </div>
        </div>
      )}

      {/* 模态框管理模块 */}
      {modal.show && (
        <UnifiedModal
          message={modal.message}
          buttons={[
            { text: '确定', onClick: modal.onConfirm || (() => setModal({ show: false, message: '', onConfirm: null, onCancel: null })), className: 'bg-theme-green' },
            { text: '取消', onClick: modal.onCancel || (() => setModal({ show: false, message: '', onConfirm: null, onCancel: null })), className: 'bg-theme-gray3' }
          ]}
        />
      )}

    </div>
  );
}

export default ChapterTreePanel;
