import { useState, useEffect } from 'react';
import ContextMenu, { type ContextMenuItem } from '../others/ContextMenu';
import httpClient from '../../utils/httpClient';

interface SelectedItem {
  id: string | null;
  isFolder: boolean;
  itemTitle: string | null;
  itemParentPath: string | null;
  state: string | null;
}

interface LastSelectedItem {
  state: string | null;
  id: string | null;
  isFolder: boolean;
  itemTitle: string | null;
  itemParentPath: string | null;
}

interface Modal {
  show: boolean;
  message: string;
  onConfirm: (() => void) | null;
}

interface ChapterContextMenuProps {
  contextMenu: { show: boolean; x: number; y: number };
  selectedItem: SelectedItem;
  setSelectedItem: (item: SelectedItem) => void;
  lastSelectedItem: LastSelectedItem;
  setLastSelectedItem: (item: LastSelectedItem) => void;
  handleCloseContextMenu: () => void;
  handleCreateItem: (isFolder: boolean, parentId: string | undefined) => void;
  fetchChapters: () => void;
  setModal: (modal: Modal) => void;
}

function ChapterContextMenu({
  contextMenu,
  selectedItem,
  setSelectedItem,
  lastSelectedItem,
  setLastSelectedItem,
  handleCloseContextMenu,
  handleCreateItem,
  fetchChapters,
  setModal
}: ChapterContextMenuProps) {
  const [adjustedY, setAdjustedY] = useState(contextMenu.y);
  // 监听看看,到底是什么导致右键空白区，item有值。
  useEffect(()=>{
    console.log("右键时，值为：",selectedItem)
  })

  const handleRenameItem = () => {
    setSelectedItem({
      state: 'renaming',
      id: selectedItem.id,
      isFolder: selectedItem.isFolder,
      itemTitle: selectedItem.itemTitle,
      itemParentPath: selectedItem.itemParentPath
    });
    handleCloseContextMenu();
  };

  const handlePaste = async (targetFolderId: string | null) => {
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
      setModal({ show: true, message: String(error), onConfirm: null });
    }
  };

  const handleConfirmDelete = async () => {
    try {
      setModal({ show: false, message: "", onConfirm: null });
      handleCloseContextMenu();
      await httpClient.delete(`/api/file/delete/${selectedItem.id}`);
      await fetchChapters();
    } catch (error) {
      console.error('删除失败:', error);
      setModal({ show: true, message: String(error), onConfirm: null });
    }
  };

  const handleDeleteItem = () => {
    if (!selectedItem.id) return;
    setModal({
      show: true,
      message: `确定要删除 "${selectedItem.id}" 吗？`,
      onConfirm: handleConfirmDelete
    });
  };

  const getContextMenuItems = (): ContextMenuItem[] => {
    const items: ContextMenuItem[] = [];
    const isItemSelected = selectedItem.id !== null && selectedItem.id !== undefined && selectedItem.id !== "";
    const canPaste = lastSelectedItem.state !== null;

    if (isItemSelected) {
      const isFolder = selectedItem.isFolder;

      items.push(
        { label: '复制', onClick: () => { setLastSelectedItem({ ...selectedItem, state: 'copying' }); handleCloseContextMenu(); } },
        { label: '剪切', onClick: () => { setLastSelectedItem({ ...selectedItem, state: 'cutting' }); handleCloseContextMenu(); } },
        { label: '重命名', onClick: handleRenameItem },
        { label: '删除', onClick: handleDeleteItem }
      );

      if (isFolder && canPaste) {
        items.push({ label: '粘贴', onClick: () => handlePaste(selectedItem.id) });
      }

      if (isFolder) {
        items.push(
          { divider: true },
          { label: '新建文件', onClick: () => handleCreateItem(false, selectedItem.id || undefined) },
          { label: '新建文件夹', onClick: () => handleCreateItem(true, selectedItem.id || undefined) }
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

  return (
    <ContextMenu
      visible={contextMenu.show}
      x={contextMenu.x}
      y={contextMenu.y}
      items={getContextMenuItems()}
      onClose={handleCloseContextMenu}
      positionType="absolute"
      enableKeyboard={true}
      enableAutoAdjust={true}
    />
  );
}

export default ChapterContextMenu;
