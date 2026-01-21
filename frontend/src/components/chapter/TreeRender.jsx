import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCaretRight, faCaretDown } from '@fortawesome/free-solid-svg-icons';
import DisplayNameHelper from '../../utils/DisplayNameHelper';
import { useDispatch, useSelector } from 'react-redux'
import { addTab, setActiveTab } from '../../store/file_editor.js';
import { toggleCollapse } from '../../store/file.js';
import { useEffect, useRef, useState } from 'react';
import httpClient from '../../utils/httpClient.js';


// 章节树节点组件
function ChapterTreeItem({ item, level, props }) {
  const dispatch = useDispatch();
  //@ts-ignore
  const tab = useSelector((state) => state.file_editor.tabId);
  //@ts-ignore
  const activeTabId = useSelector((state) => state.file_editor.activeTabId);
  //@ts-ignore
  const collapsedChapters = useSelector((state) => state.file.collapsedChapters);

  const {
    handleContextMenu,
    selectedItem,
    lastSelectedItem,
    setSelectedItem,
    fetchChapters,
    setModal
  } = props;

  const itemId = item.id || '';
  const itemTitle = item.title || '';
  const isFolder = item.isFolder || item.type === 'folder';
  const hasChildren = item.children && item.children.length > 0;
  const displayName = new DisplayNameHelper(itemTitle, isFolder).removeSuffix().getValue();

  const inputRef = useRef(null);
  const [editingValue, setEditingValue] = useState('');

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
  }, [selectedItem]);

  const handleSaveRename = async () => {
    if (editingValue && editingValue.trim() !== '') {
      // 只有文件才添加 .md 后缀发送给后端
      const finalName = isFolder ? editingValue : (editingValue.endsWith('.md') ? editingValue : editingValue + '.md');
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
        // 重置选中状态
        setSelectedItem({
          state: null,
          id: null,
          isFolder: false,
          itemTitle: null,
          itemParentPath: null
        });
        // 触发父组件刷新
        fetchChapters && fetchChapters();
      } catch (error) {
        console.error('重命名失败:', error);
        setModal({ show: true, message: '重命名失败: ' + error.toString(), onConfirm: null });
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

  const handleKeyDown = (e) => {
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

  const handleToggleCollapse = (itemId) => {
    dispatch(toggleCollapse(itemId));
  };

  const handleChapterClick = (item) => {
    dispatch(addTab(item.id));
    dispatch(setActiveTab(item.id));
    console.log("当前总标签页：", tab, "，当前活跃标签页：", activeTabId);
  };

  return (
    <li
      key={itemId}
      className={`chapter-list-item ${isFolder ? 'folder-item' : 'file-item'} level-${level} relative`}
    >
      {/* 垂直引导线 */}
      {level > 0 && (
        <div
          className="tree-guide-line absolute top-0 bottom-0 w-px bg-theme-gray4"
          style={{ left: `${level * 20 - 10}px` }}
        />
      )}
      <div
        className={`chapter-item-content ${isFolder && level > 0 ? 'nested-folder-content' : ''} cursor-pointer ${(selectedItem.id === itemId || lastSelectedItem.id === itemId) ? 'bg-theme-gray2 text-theme-green' : 'text-theme-white hover:text-theme-green hover:bg-theme-gray2'}`}
        style={{ paddingLeft: `${level * 20}px` }}
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
            <FontAwesomeIcon icon={collapsedChapters[itemId] ? faCaretDown : faCaretRight} />
          </span>
        )}
        {/* 文件/文件夹名称 - 编辑模式下显示输入框 */}
        {selectedItem.state === 'renaming' && selectedItem.id === itemId ? (
          <input
            ref={inputRef}
            type="text"
            value={editingValue}
            onChange={(e) => setEditingValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={handleSaveRename}
            className="chapter-title-input bg-theme-black text-theme-white border border-theme-green px-1 py-0.5 text-sm outline-none flex-1"
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span className="chapter-title-text">
            {displayName}
          </span>
        )}
      </div>
      {isFolder && hasChildren && collapsedChapters[itemId] && (
        <ul className="sub-chapter-list">
          {item.children.map(child => (
            <ChapterTreeItem
              key={child.id}
              item={child}
              level={level + 1}
              props={props}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

export default ChapterTreeItem;
