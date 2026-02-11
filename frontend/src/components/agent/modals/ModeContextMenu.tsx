import { type ContextMenuItem } from '../../others/ContextMenu';
import ContextMenu from '../../others/ContextMenu';

interface ModeContextMenuProps {
  visible: boolean;
  x: number;
  y: number;
  modeId: string | null;
  modesData: Record<string, any>;
  onRename: (modeId: string) => void;
  onDelete: (modeId: string) => void;
  onClose: () => void;
  enableKeyboard?: boolean;
  enableAutoAdjust?: boolean;
}

const ModeContextMenu = ({
  visible,
  x,
  y,
  modeId,
  modesData,
  onRename,
  onDelete,
  onClose,
  enableKeyboard = true,
  enableAutoAdjust = true
}: ModeContextMenuProps) => {
  const menuItems: ContextMenuItem[] = (() => {
    if (!modeId) return [];
    
    const items: ContextMenuItem[] = [];

    // 不区分是否为内置模式，都可以重命名和删除
    items.push({
      label: '重命名',
      onClick: () => onRename(modeId)
    });
    items.push({
      label: '删除',
      onClick: () => onDelete(modeId)
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

export default ModeContextMenu;
