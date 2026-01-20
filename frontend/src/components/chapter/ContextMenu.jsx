import { useEffect, useRef, useState } from 'react';

function ContextMenu({
  contextMenu,
  selectedItem,
  setSelectedItem,
  lastSelectedItem,
  setLastSelectedItem,
  handleCloseContextMenu,
  handleCreateItem,
  handleDeleteItem,
  handlePaste,
  handleRenameItem
}) {
  const menuRef = useRef(null);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [adjustedY, setAdjustedY] = useState(contextMenu.y);

  const getContextMenuItems = () => {
    const items = [];
    const isItemSelected = selectedItem.id !== null && selectedItem.id !== undefined;
    const canPaste = lastSelectedItem.state !== null;

    if (isItemSelected) {
      const isFolder = selectedItem.isFolder;

      items.push(
        { label: '复制', onClick: () => { setLastSelectedItem({ ...selectedItem, state: 'copying' }); handleCloseContextMenu(); } },
        { label: '剪切', onClick: () => { setLastSelectedItem({ ...selectedItem, state: 'cutting' }); handleCloseContextMenu(); } },
        { label: '重命名', onClick: () => { setSelectedItem({ ...selectedItem, state: 'renaming' }); handleRenameItem(); } },
        { label: '删除', onClick: () => handleDeleteItem(selectedItem.id) }
      );
      if (isFolder && canPaste) {
        items.push({ label: '粘贴', onClick: () => handlePaste(selectedItem.id) });
      }

      if (isFolder) {
        items.push(
          { label: '新建文件', onClick: () => handleCreateItem(false, selectedItem.id) },
          { label: '新建文件夹', onClick: () => handleCreateItem(true, selectedItem.id) }
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
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        handleCloseContextMenu();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [contextMenu]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      const items = getContextMenuItems();
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prevIndex) =>
          prevIndex > 0 ? prevIndex - 1 : items.length - 1
        );
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prevIndex) =>
          prevIndex < items.length - 1 ? prevIndex + 1 : 0
        );
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (selectedIndex !== -1) {
          items[selectedIndex].onClick();
          handleCloseContextMenu();
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        handleCloseContextMenu();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [selectedIndex, contextMenu, selectedItem]);

  useEffect(() => {
    if (menuRef.current) {
      menuRef.current.focus();
    }
  }, []);

  useEffect(() => {
    if (menuRef.current && contextMenu.show) {
      const menu = menuRef.current;
      const menuRect = menu.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      
      // 检查下边界，如果超出则向上显示
      if (contextMenu.y + menuRect.height > viewportHeight) {
        setAdjustedY(contextMenu.y - menuRect.height);
      } else {
        setAdjustedY(contextMenu.y);
      }
    }
  }, [contextMenu.show, contextMenu.y]);

  if (!contextMenu.show) return null;

  const items = getContextMenuItems();

  return (
    <ul
      className="absolute bg-theme-gray1 border border-theme-gray3 rounded-small shadow-medium list-none p-0 m-0 z-[1000] text-sm min-w-[120px]"
      ref={menuRef}
      style={{ top: adjustedY, left: contextMenu.x }}
      tabIndex={-1}
    >
      {items.map((item, index) => (
        <li
          key={index}
          className={`p-2 cursor-pointer ${selectedIndex === index ? 'bg-theme-gray2 text-theme-green' : 'text-theme-white hover:bg-theme-gray2 hover:text-theme-green'}`}
          onClick={() => {
            item.onClick();
            handleCloseContextMenu();
          }}
          onMouseEnter={() => setSelectedIndex(index)}
        >
          {item.label}
        </li>
      ))}
    </ul>
  );
}

export default ContextMenu;