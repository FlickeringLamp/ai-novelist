import { type ContextMenuItem } from '../../others/ContextMenu';
import ContextMenu from '../../others/ContextMenu';

interface BaseContextMenuProps {
  visible: boolean;
  x: number;
  y: number;
  knowledgeBaseId: string | null;
  onRename: (knowledgeBaseId: string) => void;
  onDelete: (knowledgeBaseId: string) => void;
  onClose: () => void;
  enableKeyboard?: boolean;
  enableAutoAdjust?: boolean;
}

const BaseContextMenu = ({
  visible,
  x,
  y,
  knowledgeBaseId,
  onRename,
  onDelete,
  onClose,
  enableKeyboard = true,
  enableAutoAdjust = true
}: BaseContextMenuProps) => {
  const menuItems: ContextMenuItem[] = (() => {
    if (!knowledgeBaseId) return [];
    
    const items: ContextMenuItem[] = [];
    items.push({
      label: '重命名',
      onClick: () => onRename(knowledgeBaseId)
    });
    items.push({
      label: '删除',
      onClick: () => onDelete(knowledgeBaseId)
    });

    return items;
  })();

  return (
    <ContextMenu
      visible={visible}
      x={x}
      y={y}
      onClose={onClose}
      items={menuItems}
      enableKeyboard={enableKeyboard}
      enableAutoAdjust={enableAutoAdjust}
    />
  );
};

export default BaseContextMenu;
