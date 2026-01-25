import DisplayNameHelper from "../../../utils/DisplayNameHelper.ts";
import { useCallback } from 'react';

interface TabBarProps {
  tabBarId: string;
  tabBar: {
    tabs: string[];
    activeTabId: string | null;
  };
  isActive: boolean;
  dirtyTabIds: Set<string>;
  draggedIndex: number | null;
  dragOverIndex: number | null;
  draggedTabBarId: string | null;
  scrollContainerRef: (el: HTMLDivElement | null) => void;
  onTabClick: (tabId: string) => void;
  onTabClose: (tabId: string) => void;
  onTabContextMenu: (e: React.MouseEvent, tabId: string) => void;
  onTabDragStart: (index: number) => void;
  onTabDragEnd: () => void;
  onTabDragOver: (index: number) => void;
  onTabDrop: (fromIndex: number, toIndex: number) => void;
  onDraggedTabBarIdSet: (tabBarId: string) => void;
}

const TabBar = ({
  tabBarId,
  tabBar,
  isActive,
  dirtyTabIds,
  draggedIndex,
  dragOverIndex,
  draggedTabBarId,
  scrollContainerRef,
  onTabClick,
  onTabClose,
  onTabContextMenu,
  onTabDragStart,
  onTabDragEnd,
  onTabDragOver,
  onTabDrop,
  onDraggedTabBarIdSet,
}: TabBarProps) => {

  // 拖动功能函数
  const handleTabDragStart = useCallback((index: number) => {
    onTabDragStart(index);
    onDraggedTabBarIdSet(tabBarId);
  }, [onTabDragStart, onDraggedTabBarIdSet, tabBarId]);

  const handleTabDrop = useCallback((fromIndex: number, toIndex: number) => {
    if (draggedTabBarId === tabBarId) {
      onTabDrop(fromIndex, toIndex);
    }
    onTabDragEnd();
  }, [draggedTabBarId, tabBarId, onTabDrop, onTabDragEnd]);

  const handleTabDragOver = useCallback((index: number) => {
    if (draggedTabBarId === tabBarId) {
      onTabDragOver(index);
    }
  }, [draggedTabBarId, tabBarId, onTabDragOver]);

  return (
    <div className="border-b border-theme-gray3">
      {/* 标签栏区域 */}
      <div
        ref={scrollContainerRef}
        className={`flex border-b border-theme-gray3 h-[60%] overflow-x-auto ${isActive ? 'bg-theme-gray2' : ''}`}
      >
        {/* 遍历当前标签栏的所有标签 */}
        {tabBar.tabs.map((tab, index) => (
          <div
            key={tab}
            draggable
            className={`px-3 cursor-pointer transition-all border-r border-theme-gray3 whitespace-nowrap flex items-center gap-2 ${tabBar.activeTabId === tab ? 'bg-theme-gray2 text-theme-green border-t-1 border-t-theme-green' : 'text-theme-white hover:bg-theme-gray2'} ${draggedIndex === index && draggedTabBarId === tabBarId ? 'opacity-50' : ''} ${dragOverIndex === index && draggedTabBarId === tabBarId ? 'border-l-2 border-l-theme-green' : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              onTabClick(tab);
            }}
            onContextMenu={(e) => onTabContextMenu(e, tab)}
            onDragStart={(e) => {
              handleTabDragStart(index);
              e.dataTransfer.effectAllowed = 'move';
            }}
            onDragEnd={onTabDragEnd}
            onDragOver={(e) => {
              e.preventDefault();
              if (draggedIndex !== null && draggedIndex !== index) {
                handleTabDragOver(index);
              }
            }}
            onDragLeave={() => {
              // 由父组件处理
            }}
            onDrop={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (draggedIndex !== null && draggedIndex !== index) {
                handleTabDrop(draggedIndex, index);
              }
            }}
          >
            {new DisplayNameHelper(tab).getLastDisplayName().removeSuffix().getValue()}
            <button
              className="hover:bg-theme-gray3 rounded px-1 text-xs"
              onClick={(e) => {
                e.stopPropagation();
                onTabClose(tab);
              }}
            >
              {dirtyTabIds.has(tab) ? '●' : '×'}
            </button>
          </div>
        ))}
      </div>
      {/* 地址栏区域 - 显示当前标签栏的活跃标签名称 */}
      <div className="h-[40%] text-sm text-theme-gray5 whitespace-nowrap px-3">
        {(() => {
          const activeTab = tabBar.tabs.find(tab => tab === tabBar.activeTabId);
          return activeTab ? new DisplayNameHelper(activeTab).removeSuffix().getValue() : '';
        })()}
      </div>
    </div>
  );
};

export default TabBar;
