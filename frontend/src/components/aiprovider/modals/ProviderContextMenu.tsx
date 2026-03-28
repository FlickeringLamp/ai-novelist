import type { ProviderContextMenuProps, ContextMenuItem } from '@/types';
import ContextMenu from '../../others/ContextMenu';

const ProviderContextMenu = ({
  visible,
  x,
  y,
  providerId,
  providersData,
  onRename,
  onDelete,
  onClose,
  enableKeyboard = true,
  enableAutoAdjust = true
}: ProviderContextMenuProps) => {
  const menuItems: ContextMenuItem[] = (() => {
    if (!providerId) return [];
    
    const isBuiltin = providersData[providerId]?.builtin === true;
    const items: ContextMenuItem[] = [];

    if (!isBuiltin) {
      items.push({
        label: '重命名',
        onClick: () => onRename(providerId)
      });
      items.push({
        label: '删除',
        onClick: () => onDelete(providerId)
      });
    }

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

export default ProviderContextMenu;
