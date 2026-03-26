import ContextMenu from '../../others/ContextMenu';
import type { ServerContextMenuProps, ContextMenuItem } from '@/types';

const ServerContextMenu = ({
  visible,
  x,
  y,
  serverId,
  serversData,
  onDelete,
  onClose,
  enableKeyboard = true,
  enableAutoAdjust = true
}: ServerContextMenuProps) => {
  const menuItems: ContextMenuItem[] = (() => {
    if (!serverId) return [];
    
    const items: ContextMenuItem[] = [];
    items.push({
      label: '删除',
      onClick: () => onDelete(serverId)
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

export default ServerContextMenu;
