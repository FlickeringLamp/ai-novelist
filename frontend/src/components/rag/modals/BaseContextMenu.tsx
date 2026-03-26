import ContextMenu from '../../others/ContextMenu';
import type { ContextMenuItem, BaseContextMenuProps } from '@/types';

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
