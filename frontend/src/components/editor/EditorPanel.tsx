import { useSelector, useDispatch } from 'react-redux';
import { useRef, useEffect, useState, useCallback } from 'react';
import { setActiveTab, setActiveTabBar, decreaseTab, dirtyTabs, reorderTabs, getTabBarsWithContent } from '../../store/editor';
import type { RootState } from '../../types';
import TabBarEditorArea from './editor/EditorArea.tsx';
import CloseTabConfirmModal from './tab/CloseTabConfirmModal.tsx';
import ErrorModal from '../others/ErrorModal.tsx';
import EditorContextMenu from './tab/TabContextMenu.tsx';
import TabBar from './tab/TabBar.tsx';
import EditorLogo from '../others/Logo.tsx';

// 检查指定文件是否只在指定标签栏有脏状态（其他标签栏都没有该文件的脏状态）
const isDirtyOnlyInThisTabBar = (
  tabId: string,
  tabBarId: string,
  tabBars: RootState['tabSlice']['tabBars'],
  backUp: RootState['tabSlice']['backUp'],
  currentData: RootState['tabSlice']['currentData']
): boolean => {
  // 首先检查当前标签栏是否有脏状态
  const currentTabBar = tabBars[tabBarId];
  if (!currentTabBar?.tabs.includes(tabId)) {
    return false;
  }
  const backUpContent = backUp[tabId];
  const currentContent = currentData[tabId];
  if (backUpContent === undefined || currentContent === backUpContent) {
    return false; // 当前标签栏没有脏状态
  }

  // 检查其他标签栏是否也有该文件的脏状态
  for (const [otherTabBarId, otherTabBar] of Object.entries(tabBars)) {
    if (otherTabBarId === tabBarId) continue;
    if (otherTabBar.tabs.includes(tabId)) {
      const otherBackUp = backUp[tabId];
      const otherCurrent = currentData[tabId];
      if (otherBackUp !== undefined && otherCurrent !== otherBackUp) {
        // 其他标签栏也有该文件的脏状态
        return false;
      }
    }
  }

  return true; // 只有当前标签栏有脏状态
};

//（最外层容器）
const EditorPanel = () => {
  const allState = useSelector((state:RootState)=> state.tabSlice);
  const tabBars = useSelector(getTabBarsWithContent);
  const hasTabBars = Object.keys(tabBars).length > 0 // tabBars为{}依然是true，只能判断键的数量
  const activeTabBarId = useSelector((state: RootState) => state.tabSlice.activeTabBarId);
  const dirtyTabIds = useSelector(dirtyTabs); // 全局脏状态，用于显示指示器
  const dispatch = useDispatch();
  const scrollContainerRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [modalTab, setModalTab] = useState<string | null>(null); // 用于标记关闭脏状态标签（只有脏状态标签关闭时需要弹窗）
  const [modalTabBarId, setModalTabBarId] = useState<string | null>(null); // 标记关闭的脏状态标签属于哪个标签栏
  const [errorModal, setErrorModal] = useState<string | null>(null);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null); // 这三个是用来支持跨编辑页拖动的状态
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  
  // 右键菜单状态
  const [contextMenuVisible, setContextMenuVisible] = useState(false);
  const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 });
  const [contextMenuTabId, setContextMenuTabId] = useState<string | null>(null);
  const [contextMenuTabBarId, setContextMenuTabBarId] = useState<string | null>(null);

  useEffect(() => {
    // 检查当前活跃标签栏是否有内容
    console.log("编辑器面板的状态正常:",allState)
    console.log("hasTabBars:",hasTabBars)
    console.log("tabBars:",tabBars)
    const currentTabBar = allState.tabBars[activeTabBarId];
    const hasContent = currentTabBar && currentTabBar.tabs.length > 0;
    
    // 如果当前活跃标签栏没有内容，需要切换到有内容的标签栏
    if (!hasContent) {
      const tabBarIds = Object.keys(tabBars);
      if (tabBarIds.length > 0) {
        // 切换到第一个有内容的标签栏
        dispatch(setActiveTabBar({ tabBarId: tabBarIds[0]! }));
      }
    }
  }, [tabBars])

  useEffect(() => {
    // 为每个标签栏容器绑定滚轮事件
    Object.entries(scrollContainerRefs.current).forEach(([tabBarId, container]) => {
      if (!container) return;

      const handleWheel = (e: WheelEvent) => {
        if (e.deltaY !== 0) {
          e.preventDefault();
          container.scrollLeft += e.deltaY;
        }
      };

      container.addEventListener('wheel', handleWheel, { passive: false });
      
      return () => {
        container.removeEventListener('wheel', handleWheel);
      };
    });
  }, [tabBars]);

  // 处理右键菜单
  const handleContextMenu = useCallback((e: React.MouseEvent, tabId: string, tabBarId: string) => {
    e.preventDefault();
    e.stopPropagation();

    // 右键时将该标签设置为活跃标签
    dispatch(setActiveTabBar({ tabBarId }));
    dispatch(setActiveTab({ tabId }));

    setContextMenuTabId(tabId);
    setContextMenuTabBarId(tabBarId);
    setContextMenuPosition({ x: e.clientX, y: e.clientY });
    setContextMenuVisible(true);
  }, [activeTabBarId, dispatch]);

  return (
    <div className='h-full'>
      <div className="bg-theme-gray1 h-full flex flex-row">
        {/* 遍历所有"标签栏+地址栏+编辑器" */}
        {hasTabBars ? (Object.entries(tabBars).map(([tabBarId, tabBar]) => (
          // 标签栏与编辑器垂直排列
          <div key={tabBarId} className="flex flex-col min-w-0 h-full" style={{ flex: 1 }}>
            {/* 标签栏和地址栏组件 */}
            <TabBar
              tabBarId={tabBarId}
              tabBar={tabBar}
              isActive={activeTabBarId === tabBarId}
              dirtyTabIds={dirtyTabIds}
              draggedIndex={draggedIndex}
              dragOverIndex={dragOverIndex}
              scrollContainerRef={(el) => { scrollContainerRefs.current[tabBarId] = el; }}
              onTabClick={(tabId) => {
                dispatch(setActiveTabBar({ tabBarId }));
                dispatch(setActiveTab({ tabId }));
              }}
              onTabClose={(tabId) => {
                dispatch(setActiveTabBar({ tabBarId }));
                // 只有该文件仅在当前标签栏有脏状态时才弹窗
                if (isDirtyOnlyInThisTabBar(tabId, tabBarId, allState.tabBars, allState.backUp, allState.currentData)) {
                  setModalTab(tabId);
                  setModalTabBarId(tabBarId);
                } else {
                  dispatch(decreaseTab({ tabId }));
                }
              }}
              onTabContextMenu={(e, tabId) => handleContextMenu(e, tabId, tabBarId)}
              onTabDragStart={(index) => setDraggedIndex(index)}
              onTabDragEnd={() => {
                setDraggedIndex(null);
                setDragOverIndex(null);
              }}
              onTabDragOver={(index) => setDragOverIndex(index)}
              onTabDrop={(fromIndex, toIndex) => dispatch(reorderTabs({ fromIndex, toIndex }))}
            />
            {/* 编辑器区域 */}
            <TabBarEditorArea
              tabBar={tabBar}
              tabBarId={tabBarId}
            />
          </div>
        ))):(
          <div className="flex-1 flex items-center justify-center">
            <EditorLogo/>
          </div>
        )}
      </div>

      {/* 弹窗处理 */}
      {(() => {
        const tabBar = tabBars[modalTabBarId!];
        const tab = tabBar?.tabs.find(t => t === modalTab);
        const tabContent = tab ? (allState.currentData[tab] || '') : '';
        return (
          <CloseTabConfirmModal
            tabId={modalTab}
            tabBarId={modalTabBarId}
            tabContent={tabContent}
            onClose={() => {
              setModalTab(null);
              setModalTabBarId(null);
            }}
            onError={(error) => {
              setErrorModal(error);
            }}
          />
        );
      })()}

      {/* 错误提示模态框 */}
      <ErrorModal
        errorMessage={errorModal}
        onClose={() => setErrorModal(null)}
      />

      {/* 右键菜单 */}
      <EditorContextMenu
        visible={contextMenuVisible}
        x={contextMenuPosition.x}
        y={contextMenuPosition.y}
        tabId={contextMenuTabId}
        tabBarId={contextMenuTabBarId}
        activeTabBarId={activeTabBarId}
        onClose={() => setContextMenuVisible(false)}
      />
    </div>
  );
};

export default EditorPanel;
