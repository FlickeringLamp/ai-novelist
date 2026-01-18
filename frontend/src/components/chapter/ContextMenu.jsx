import { useEffect, useRef, useState } from 'react';

function ContextMenu({
  contextMenu,
  setContextMenu,
  operateState,
  setOperateState,
  handleCreateItem,
  handleDeleteItem,
  handlePaste,
  handleRenameItem
}) {
  const menuRef = useRef(null);
  const [selectedIndex, setSelectedIndex] = useState(-1);

  const handleCloseContextMenu = () => {
    setContextMenu({ ...contextMenu, show: false });
  };

  const getContextMenuItems = () => {
    const items = [];
    const isItemSelected = contextMenu.itemId !== null && contextMenu.itemId !== undefined;
    const canPaste = operateState;

    if (isItemSelected) {
      const isFolder = contextMenu.isFolder;

      items.push(
        { label: '复制', onClick: () => { setOperateState('copying'); handleCloseContextMenu(); } },
        { label: '剪切', onClick: () => { setOperateState('cutting'); handleCloseContextMenu(); } },
        { label: '重命名', onClick: () => handleRenameItem() },
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
  }, [selectedIndex, contextMenu, operateState]);

  useEffect(() => {
    if (menuRef.current) {
      menuRef.current.focus();
    }
  }, []);

  if (!contextMenu.show) return null;

  const items = getContextMenuItems();

  return (
    <ul
      className="absolute bg-theme-black border border-theme-gray rounded-small shadow-medium list-none p-0 m-0 z-[1000] text-sm min-w-[120px]"
      ref={menuRef}
      style={{ top: contextMenu.y, left: contextMenu.x }}
      tabIndex={-1}
    >
      {items.map((item, index) => (
        <li
          key={index}
          className={`p-2 cursor-pointer text-theme-white ${selectedIndex === index ? 'bg-theme-gray text-theme-green' : ''} hover:bg-theme-gray hover:text-theme-green active:bg-theme-gray`}
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
