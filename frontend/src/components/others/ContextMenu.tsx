import { useEffect, useRef, useState } from 'react';
import type { ContextMenuProps, ContextMenuItem } from '@/types';

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
    if (!visible || !enableKeyboard || items.length === 0) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prevIndex) => {
          let newIndex = prevIndex > 0 ? prevIndex - 1 : items.length - 1;
          // 跳过分隔线
          let loopCount = 0;
          while (items[newIndex]?.divider && loopCount < items.length) {
            newIndex = newIndex > 0 ? newIndex - 1 : items.length - 1;
            loopCount++;
          }
          return newIndex;
        });
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prevIndex) => {
          let newIndex = prevIndex < items.length - 1 ? prevIndex + 1 : 0;
          // 跳过分隔线
          let loopCount = 0;
          while (items[newIndex]?.divider && loopCount < items.length) {
            newIndex = newIndex < items.length - 1 ? newIndex + 1 : 0;
            loopCount++;
          }
          return newIndex;
        });
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
    const rect = menu.getBoundingClientRect();
    const windowHeight = window.innerHeight;

    if (rect.bottom > windowHeight) {
      setAdjustedY(y - rect.height);
    } else {
      setAdjustedY(y);
    }
  }, [visible, y, enableAutoAdjust]);

  // 可见性变化时重置选中状态
  useEffect(() => {
    if (visible) {
      setSelectedIndex(-1);
    }
  }, [visible]);

  if (!visible) return null;

  const handleItemClick = (item: ContextMenuItem) => {
    if (item.disabled || item.divider) return;
    item.onClick?.();
    onClose?.();
  };

  return (
    <div
      ref={menuRef}
      className={`bg-theme-gray1 rounded-medium shadow-medium min-w-[120px] py-1 z-[1000] ${className}`}
      style={{
        position: positionType,
        left: x,
        top: adjustedY,
      }}
    >
      {items.map((item, index) => (
        item.divider ? (
          <div
            key={`divider-${index}`}
            className="h-px bg-theme-gray3 my-1 mx-2"
          />
        ) : (
          <button
            key={index}
            onClick={() => handleItemClick(item)}
            disabled={item.disabled}
            className={`
              w-full px-4 py-2 text-left text-sm transition-colors
              ${item.disabled
                ? 'text-theme-gray4 cursor-not-allowed'
                : selectedIndex === index
                  ? 'bg-theme-green text-theme-black'
                  : 'text-theme-white hover:bg-theme-gray2'
              }
            `}
          >
            {item.label}
          </button>
        )
      ))}
    </div>
  );
};

export default ContextMenu;
