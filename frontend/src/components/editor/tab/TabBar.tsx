import DisplayNameHelper from "../../../utils/DisplayNameHelper.ts";
import { useCallback } from 'react';
import { useDispatch, useSelector } from "react-redux";
import { setActiveTabBar, type RootState } from "../../../store/editor.ts";

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
  scrollContainerRef: (el: HTMLDivElement | null) => void;
  onTabClick: (tabId: string) => void;
  onTabClose: (tabId: string) => void;
  onTabContextMenu: (e: React.MouseEvent, tabId: string) => void;
  onTabDragStart: (index: number) => void;
  onTabDragEnd: () => void;
  onTabDragOver: (index: number) => void;
  onTabDrop: (fromIndex: number, toIndex: number) => void;
}

const TabBar = ({
  tabBarId,
  tabBar,
  isActive,
  dirtyTabIds,
  draggedIndex,
  dragOverIndex,
  scrollContainerRef,
  onTabClick,
  onTabClose,
  onTabContextMenu,
  onTabDragStart,
  onTabDragEnd,
  onTabDragOver,
  onTabDrop,
}: TabBarProps) => {
  const dispatch = useDispatch();
  const activeTabBarId = useSelector((state: RootState) => state.tabSlice.activeTabBarId);

  // 拖动功能函数
  // 拖拽开始
  const handleTabDragStart = useCallback((index: number) => {
    onTabDragStart(index);
    dispatch(setActiveTabBar({ tabBarId }));
  }, [onTabDragStart, dispatch, tabBarId]);
  // 拖拽结束（暂时只允许标签栏内拖动，不支持跨标签栏）
  const handleTabDrop = useCallback((fromIndex: number, toIndex: number) => {
    if (activeTabBarId === tabBarId) {
      onTabDrop(fromIndex, toIndex);
    }
    onTabDragEnd();
  }, [activeTabBarId, tabBarId, onTabDrop, onTabDragEnd]);
  // 拖到上方
  const handleTabDragOver = useCallback((index: number) => {
    if (activeTabBarId === tabBarId) {
      onTabDragOver(index);
    }
  }, [activeTabBarId, tabBarId, onTabDragOver]);

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
            className={`px-3 cursor-pointer transition-all border-r border-theme-gray3 whitespace-nowrap flex items-center gap-2 ${tabBar.activeTabId === tab ? 'bg-theme-gray2 text-theme-green border-t-1 border-t-theme-green' : 'text-theme-white hover:bg-theme-gray2'} ${draggedIndex === index && activeTabBarId === tabBarId ? 'opacity-50' : ''} ${dragOverIndex === index && activeTabBarId === tabBarId ? 'border-l-2 border-l-theme-green' : ''}`}
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
