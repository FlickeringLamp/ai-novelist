import { type ContextMenuItem } from '../../others/ContextMenu';
import ContextMenu from '../../others/ContextMenu';

interface ProviderContextMenuProps {
  visible: boolean;
  x: number;
  y: number;
  providerId: string | null;
  providersData: Record<string, any>;
  onRename: (providerId: string) => void;
  onDelete: (providerId: string) => void;
  onClose: () => void;
  enableKeyboard?: boolean;
  enableAutoAdjust?: boolean;
}

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
