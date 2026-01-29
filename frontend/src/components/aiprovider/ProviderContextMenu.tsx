import { type ContextMenuItem } from '../others/ContextMenu';
import ContextMenu from '../others/ContextMenu';

interface ProviderContextMenuProps {
  visible: boolean;
  x: number;
  y: number;
  providerId: string | null;
  builtinProviders: string[];
  onRename: (providerId: string) => void;
  onDelete: (providerId: string) => void;
  onClose: () => void;
}

const ProviderContextMenu = ({
  visible,
  x,
  y,
  providerId,
  builtinProviders,
  onRename,
  onDelete,
  onClose
}: ProviderContextMenuProps) => {
  const menuItems: ContextMenuItem[] = (() => {
    if (!providerId) return [];
    
    const isBuiltin = builtinProviders.includes(providerId);
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
    />
  );
};

export default ProviderContextMenu;
