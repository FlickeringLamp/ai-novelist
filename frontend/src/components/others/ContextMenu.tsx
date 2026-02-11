import { useEffect, useRef, useState } from 'react';

export interface ContextMenuItem {
  label?: string;
  onClick?: () => void;
  disabled?: boolean;
  divider?: boolean;
}

export interface ContextMenuProps {
  visible: boolean;
  x: number;
  y: number;
  items: ContextMenuItem[];
  onClose?: () => void;
  positionType?: 'fixed' | 'absolute';
  enableKeyboard?: boolean;
  enableAutoAdjust?: boolean;
  className?: string;
}

const ContextMenu = ({
  visible,
  x,
  y,
  items,
  onClose,
  positionType = 'fixed',
  enableKeyboard = false,
  enableAutoAdjust = false,
  className = '',
}: ContextMenuProps) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [adjustedY, setAdjustedY] = useState(y);

  // 点击外部关闭
  useEffect(() => {
    if (!visible) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose?.();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [visible, onClose]);

  // 键盘导航
  useEffect(() => {
    if (!visible || !enableKeyboard) return;

    const handleKeyDown = (e: KeyboardEvent) => {
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
        const enabledItems = items.filter(item => !item.disabled);
        if (selectedIndex !== -1 && enabledItems[selectedIndex] && enabledItems[selectedIndex].onClick) {
          enabledItems[selectedIndex].onClick();
          onClose?.();
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose?.();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [visible, selectedIndex, items, onClose, enableKeyboard]);

  // 自动调整位置
  useEffect(() => {
    if (!visible || !enableAutoAdjust || !menuRef.current) return;

    const menu = menuRef.current;
    const menuRect = menu.getBoundingClientRect();
    const viewportHeight = window.innerHeight;

    // 检查下边界，如果超出则向上显示
    if (y + menuRect.height > viewportHeight) {
      setAdjustedY(y - menuRect.height);
    } else {
      setAdjustedY(y);
    }
  }, [visible, y, enableAutoAdjust]);

  if (!visible) return null;

  const baseClassName = `bg-theme-gray2 border border-theme-gray3 shadow-lg rounded min-w-[160px] z-50 ${className}`;

  return (
    <div
      ref={menuRef}
      className={positionType === 'fixed' ? `fixed ${baseClassName}` : `absolute ${baseClassName}`}
      style={{ left: x, top: enableAutoAdjust ? adjustedY : y }}
      onClick={(e) => e.stopPropagation()}
    >
      {items.map((item, index) => {
        if (item.divider) {
          return <div key={`divider-${index}`} className="border-t border-theme-gray3" />;
        }

        const isDisabled = item.disabled === true;
        const itemClassName = `px-4 py-2 cursor-pointer text-sm text-theme-white ${
          isDisabled
            ? 'opacity-50 cursor-not-allowed'
            : enableKeyboard && selectedIndex === index
            ? 'bg-theme-gray3 text-theme-green'
            : 'hover:bg-theme-gray3 hover:text-theme-green'
        }`;

        return (
          <div
            key={index}
            className={itemClassName}
            onClick={() => {
              if (!isDisabled && item.onClick) {
                item.onClick();
                onClose?.();
              }
            }}
            onMouseEnter={() => {
              if (enableKeyboard && !isDisabled) {
                setSelectedIndex(index);
              }
            }}
          >
            {item.label}
          </div>
        );
      })}
    </div>
  );
};

export default ContextMenu;
