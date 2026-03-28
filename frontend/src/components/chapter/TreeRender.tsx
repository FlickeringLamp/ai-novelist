import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faAngleRight, faAngleDown } from '@fortawesome/free-solid-svg-icons';
import DisplayNameHelper from '../../utils/DisplayNameHelper.ts';
import { useDispatch, useSelector } from 'react-redux'
import { addTab, setActiveTab, updateTabId } from '../../store/editor.ts';
import { toggleCollapse } from '../../store/file.ts';
import { useEffect, useRef, useState } from 'react';
import httpClient from '../../utils/httpClient.ts';
import CreateInput from './CreateInput.tsx';
import type { ChapterItem, ChapterTreeItemProps } from '@/types';

// 章节树节点组件
function ChapterTreeItem({ item, level, creatingItem, onConfirmCreate, onCancelCreate, props }: ChapterTreeItemProps) {
  const dispatch = useDispatch();
  const collapsedChapters = useSelector((state: any) => state.fileSlice.collapsedChapters);

  const {
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
  } = props;

  const itemId = item.id || '';
  const itemTitle = item.title || '';
  const isFolder = item.isFolder || item.type === 'folder';
  const hasChildren = item.children && item.children.length > 0;
  const displayName = itemTitle;

  const inputRef = useRef<HTMLInputElement>(null);
  const expandTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [editingValue, setEditingValue] = useState('');
  const [showInvalidCharWarning, setShowInvalidCharWarning] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  // 检查是否包含特殊字符
  const containsInvalidChars = (value: string): boolean => {
    const invalidChars = /[*\\/<>:|?"']/;
    return invalidChars.test(value);
  };

  // 进入编辑模式时，自动聚焦并选中输入框
  useEffect(() => {
    if (selectedItem.state === 'renaming' && selectedItem.id === itemId) {
      setEditingValue(displayName);
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          inputRef.current.select();
        }
      }, 0);
    }
  }, [selectedItem, itemId, displayName]);

  // 清理展开定时器
  useEffect(() => {
    return () => {
      if (expandTimerRef.current) {
        clearTimeout(expandTimerRef.current);
      }
    };
  }, []);

  const handleSaveRename = async () => {
    if (editingValue && editingValue.trim() !== '') {
      // 检查是否包含特殊字符
      if (containsInvalidChars(editingValue)) {
        setModal({
          show: true,
          message: '不可包含* " \ / < > : | 特殊字符',
          onConfirm: () => setModal({ show: false, message: '', onConfirm: null, onCancel: null }),
          onCancel: null
        });
        return;
      }

      const finalName = editingValue;
      // 检查名称是否真的改变了
      if (finalName === itemTitle) {
        // 名称未改变，直接取消编辑
        setSelectedItem({
          state: null,
          id: null,
          isFolder: false,
          itemTitle: null,
          itemParentPath: null
        });
        return;
      }
      try {
        await httpClient.post('/api/file/rename', {
          old_path: itemId,
          new_name: finalName
        });
        // 计算新的文件路径
        const parentPath = itemId.includes('/') ? itemId.substring(0, itemId.lastIndexOf('/')) : '';
        const newId = parentPath ? `${parentPath}/${finalName}` : finalName;
        // 更新标签栏中的标签id（如果该文件在标签栏中打开）
        dispatch(updateTabId({ oldId: itemId, newId: newId }));
        // 重置选中状态
        setSelectedItem({
          state: null,
          id: null,
          isFolder: false,
          itemTitle: null,
          itemParentPath: null
        });
      } catch (error) {
        console.error('重命名失败:', error);
        setModal({ show: true, message: '重命名失败: ' + (error as Error).toString(), onConfirm: null, onCancel: null });
      }
    } else {
      // 取消编辑
      setSelectedItem({
        state: null,
        id: null,
        isFolder: false,
        itemTitle: null,
        itemParentPath: null
      });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSaveRename();
    } else if (e.key === 'Escape') {
      setSelectedItem({
        state: null,
        id: null,
        isFolder: false,
        itemTitle: null,
        itemParentPath: null
      });
    }
  };

  const handleToggleCollapse = (itemId: string) => {
    dispatch(toggleCollapse(itemId));
  };

  const handleChapterClick = async (item: ChapterItem) => {
    try {
      const response = await httpClient.get(`/api/file/read/${item.id}`);
      dispatch(addTab({ id: response.id, content: response.content }));
      dispatch(setActiveTab({ tabId: item.id }));
    } catch (error) {
      console.error('获取文件内容失败:', error);
    }
  };

  // 检查是否在当前文件夹中创建新文件/文件夹
  const isCreatingHere = creatingItem.isCreating && creatingItem.parentPath === itemId;

  // 检查是否是自身的后代（防止文件夹拖入自己内部）
  const isDescendantOf = (ancestorId: string, descendantId: string): boolean => {
    if (!descendantId || !ancestorId) return false;
    if (descendantId === ancestorId) return true;
    // 检查后缀：如果 descendantId 以 ancestorId + '/' 开头，则是后代
    return descendantId.startsWith(ancestorId + '/');
  };

  // 拖拽开始
  const handleDragStart = (e: React.DragEvent<HTMLDivElement>) => {
    setDraggedItemId(itemId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', itemId);
    // 设置拖拽时的半透明效果
    e.dataTransfer.setDragImage(e.currentTarget as Element, 0, 0);
  };

  // 拖拽结束
  const handleDragEnd = () => {
    setDraggedItemId(null);
    setDropTargetId(null);
    setIsDragOver(false);
  };

  // 拖拽经过
  const handleDragOver = (e: React.DragEvent<HTMLLIElement>) => {
    e.preventDefault();
    e.stopPropagation();

    // 如果不是文件夹，不能作为放置目标
    if (!isFolder) return;

    // 不能拖到自己身上
    if (draggedItemId === itemId) return;

    // 不能拖到正在拖拽的项的后代身上
    if (draggedItemId && isDescendantOf(itemId, draggedItemId)) return;

    e.dataTransfer.dropEffect = 'move';
    setDropTargetId(itemId);
    setIsDragOver(true);

    // 延迟展开文件夹：如果文件夹是关闭的（collapsedChapters[itemId]为false/undefined），800ms后自动展开
    if (!collapsedChapters[itemId] && !expandTimerRef.current) {
      expandTimerRef.current = setTimeout(() => {
        dispatch(toggleCollapse(itemId));
        expandTimerRef.current = null;
      }, 800);
    }
  };

  // 拖拽离开
  const handleDragLeave = (e: React.DragEvent<HTMLLIElement>) => {
    e.preventDefault();
    e.stopPropagation();

    // 检查是否真的离开了当前元素（而不是进入了子元素）
    const rect = (e.currentTarget as Element).getBoundingClientRect();
    const x = e.clientX;
    const y = e.clientY;
    if (x < rect.left || x >= rect.right || y < rect.top || y >= rect.bottom) {
      setIsDragOver(false);
      if (dropTargetId === itemId) {
        setDropTargetId(null);
      }
      // 不取消展开定时器，让文件夹保持展开
    }
  };

  // 放置
  const handleDrop = async (e: React.DragEvent<HTMLLIElement>) => {
    e.preventDefault();
    e.stopPropagation();

    setIsDragOver(false);
    setDropTargetId(null);

    // 不清除展开定时器，让文件夹保持展开状态

    const sourcePath = e.dataTransfer.getData('text/plain');
    if (!sourcePath) return;

    // 不能拖到自己身上
    if (sourcePath === itemId) return;

    // 如果不是文件夹，不能作为放置目标
    if (!isFolder) return;

    // 获取源路径的父路径
    const sourceParentPath = sourcePath.includes('/')
      ? sourcePath.substring(0, sourcePath.lastIndexOf('/'))
      : '';

    // 如果拖到自己的父路径，无需移动（静默返回）
    if (sourceParentPath === itemId) {
      return;
    }

    // 不能拖到自身的后代身上
    if (isDescendantOf(itemId, sourcePath)) {
      setModal({
        show: true,
        message: '不能将文件夹移动到自身的子文件夹中',
        onConfirm: () => setModal({ show: false, message: '', onConfirm: null, onCancel: null }),
        onCancel: null
      });
      return;
    }

    await handleMoveItem(sourcePath, itemId);
  };

  // 判断是否是当前放置目标
  const isDropTarget = dropTargetId === itemId;

  return (
    <li
      key={itemId}
      className={`chapter-list-item ${isFolder ? 'folder-item' : 'file-item'} level-${level} relative
        ${isDropTarget && isFolder ? 'ring-2 ring-theme-green ring-inset' : ''}
        ${isDragOver && isFolder ? 'bg-theme-gray3' : ''}`}
      onDragOver={isFolder ? handleDragOver : undefined}
      onDragLeave={isFolder ? handleDragLeave : undefined}
      onDrop={isFolder ? handleDrop : undefined}
    >
      {/* 垂直引导线 */}
      {level > 0 && (
        <div
          className="tree-guide-line absolute top-0 bottom-0 w-px bg-theme-gray4"
          style={{ left: `${level * 20 - 10}px` }}
        />
      )}
      <div
        className={`chapter-item-content flex ${isFolder && level > 0 ? 'nested-folder-content' : ''} cursor-pointer
          ${(selectedItem.id === itemId || lastSelectedItem.id === itemId) ? 'bg-theme-gray2 text-theme-green' : 'text-theme-white hover:text-theme-green hover:bg-theme-gray2'}
          ${draggedItemId === itemId ? 'opacity-50' : ''}`}
        style={{ paddingLeft: `${level * 20}px` }}
        draggable={true}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onClick={() => {
          // 如果正在编辑，不触发点击事件
          if (selectedItem.state === 'renaming' && selectedItem.id === itemId) {
            return;
          }
          setSelectedItem({
            state: 'selected',
            id: itemId,
            isFolder: isFolder,
            itemTitle: itemTitle,
            itemParentPath: itemId.includes('/') ? itemId.substring(0, itemId.lastIndexOf('/')) : ''
          });
          if (isFolder) {
            handleToggleCollapse(itemId);
          } else {
            handleChapterClick(item);
          }
        }}
        onContextMenu={(e) => {
          e.stopPropagation();
          const parentPath = itemId.includes('/') ? itemId.substring(0, itemId.lastIndexOf('/')) : '';
          console.log("当前parentPath是:",parentPath)
          handleContextMenu(e, itemId, isFolder, itemTitle, parentPath);
        }}
      >
        {isFolder && (
          <span className="collapse-icon">
            <FontAwesomeIcon icon={collapsedChapters[itemId] ? faAngleDown : faAngleRight} />
          </span>
        )}
        {/* 文件/文件夹名称 - 编辑模式下显示输入框 */}
        {selectedItem.state === 'renaming' && selectedItem.id === itemId ? (
          <div className="flex flex-col flex-1">
            <input
              ref={inputRef}
              type="text"
              value={editingValue}
              onChange={(e) => {
                const value = e.target.value;
                setEditingValue(value);
                setShowInvalidCharWarning(containsInvalidChars(value));
              }}
              onKeyDown={handleKeyDown}
              onBlur={handleSaveRename}
              className="chapter-title-input bg-theme-black text-theme-white border border-theme-green text-sm outline-none flex-1"
              onClick={(e) => e.stopPropagation()}
            />
            {showInvalidCharWarning && (
              <span className="text-theme-red text-xs mt-1">不可包含* " \ / {"< >"} : |特殊字符</span>
            )}
          </div>
        ) : (
          <span className="chapter-title-text">
            {displayName}
          </span>
        )}
      </div>
      {/* 展开文件夹显示内容：有子项或正在创建新文件时显示 */}
      {isFolder && (collapsedChapters[itemId] || isCreatingHere) && (
        <ul className="sub-chapter-list">
          {/* 在此文件夹中创建新文件/文件夹的输入框 */}
          {isCreatingHere && (
            <li className="chapter-list-item">
              <div
                className="chapter-item-content flex cursor-pointer text-theme-green bg-theme-gray2"
                style={{ paddingLeft: `${(level + 1) * 20}px` }}
              >
                <CreateInput
                  isFolder={creatingItem.isFolder}
                  onConfirm={onConfirmCreate}
                  onCancel={onCancelCreate}
                />
              </div>
            </li>
          )}
          {hasChildren && item.children && item.children.map((child: ChapterItem) => (
            <ChapterTreeItem
              key={child.id}
              item={child}
              level={level + 1}
              creatingItem={creatingItem}
              onConfirmCreate={onConfirmCreate}
              onCancelCreate={onCancelCreate}
              props={props}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

export default ChapterTreeItem;
