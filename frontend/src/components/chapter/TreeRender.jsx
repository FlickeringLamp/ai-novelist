import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFolder, faFile, faCaretRight, faCaretDown } from '@fortawesome/free-solid-svg-icons';
import getDisplayName from '../../utils/getDisplayName';

// 渲染章节树
const renderChapterTree = (items, level = 0, props) => {
  const {
    handleContextMenu,
    handleChapterClick,
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
              <FontAwesomeIcon icon={collapsedChapters[itemId] ? faCaretDown : faCaretRight} />
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
