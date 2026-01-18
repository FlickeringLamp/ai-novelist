import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCaretRight, faCaretDown } from '@fortawesome/free-solid-svg-icons';
import getDisplayName from '../../utils/getDisplayName';

// 渲染章节树
const renderChapterTree = (items, level = 0, props) => {
  const {
    handleContextMenu,
    handleChapterClick,
    handleToggleCollapse,
    collapsedChapters
  } = props;


  return items.map(item => {
    const itemId = item.id || '';
    const itemTitle = item.title || '';
    const isFolder = item.isFolder || item.type === 'folder';
    const hasChildren = item.children && item.children.length > 0;
    const displayName = getDisplayName(itemTitle, isFolder);

    return (
      <li
        key={itemId}
        className={`chapter-list-item ${isFolder ? 'folder-item' : 'file-item'} level-${level} relative`}
      >
        {/* 垂直引导线 */}
        {level > 0 && (
          <div
            className="tree-guide-line absolute top-0 bottom-0 w-px bg-theme-white"
            style={{ left: `${level * 20 - 10}px` }}
          />
        )}
        <div
          className={`chapter-item-content ${isFolder && level > 0 ? 'nested-folder-content' : ''} cursor-pointer text-theme-white hover:text-theme-green hover:bg-theme-gray1`}
          style={{ paddingLeft: `${level * 20}px` }}
          onClick={() => {
            if (isFolder) {
              handleToggleCollapse(itemId);
            } else {
              handleChapterClick(item);
            }
          }}
          onContextMenu={(e) => {
            e.stopPropagation();
            const parentPath = isFolder ? itemId : (itemId.includes('/') ? itemId.substring(0, itemId.lastIndexOf('/')) : '');
            handleContextMenu(e, itemId, isFolder, itemTitle, parentPath);
          }}
        >
          {isFolder && (
            <span className="collapse-icon">
              <FontAwesomeIcon icon={collapsedChapters[itemId] ? faCaretDown : faCaretRight} />
            </span>
          )}
          {/* 文件/文件夹名称 */}
          <span className="chapter-title-text">
            {displayName}
          </span>
        </div>

        {isFolder && hasChildren && collapsedChapters[itemId] && (
          <ul className="sub-chapter-list">
            {renderChapterTree(item.children, level + 1, props)}
          </ul>
        )}
      </li>
    );
  });
}

export default renderChapterTree
