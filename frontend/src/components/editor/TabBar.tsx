import DisplayNameHelper from "../../utils/DisplayNameHelper";
import { useSelector, useDispatch } from 'react-redux';
import { setActiveTab, decreaseTab, dirtyTabs, saveTabContent, reorderTabs, getTabs, getActiveTab, getActiveTabBar, type RootState } from "../../store/editor";
import { useRef, useEffect, useState } from 'react';
import UnifiedModal from '../others/UnifiedModal';
import api from '../../utils/httpClient'

// 标签栏组件
const TabBar = () => {
  const activeTabBarId = useSelector((state: RootState) => state.tabSlice.activeTabBarId);
  const tabs = useSelector((state: RootState) => getTabs(state, activeTabBarId || 'bar1'));
  const activeTab = useSelector((state: RootState) => getActiveTab(state, activeTabBarId || 'bar1'));
  const dispatch = useDispatch()
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const dirtyTabIds = useSelector(dirtyTabs);
  const [modalTab, setModalTab] = useState<string | null>(null);
  const [errorModal, setErrorModal] = useState<string | null>(null);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  useEffect(() => {
    const container = scrollContainerRef.current;
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
  }, []);


  return (
    <>
      <div className="bg-theme-gray1 h-full flex flex-col border-b border-theme-gray3">
        <div
          ref={scrollContainerRef}
          className="flex overflow-x-auto border-b border-theme-gray3 h-[60%]"
        >
          {tabs.map((tab, index) => (
            <div
              key={tab.id}
              draggable
              className={`px-3 cursor-pointer transition-all border-r border-theme-gray3 whitespace-nowrap flex items-center gap-2 ${activeTab?.id === tab.id ? 'bg-theme-gray2 text-theme-green border-t-1 border-t-theme-green' : 'text-theme-white hover:bg-theme-gray2'} ${draggedIndex === index ? 'opacity-50' : ''} ${dragOverIndex === index ? 'border-l-2 border-l-theme-green' : ''}`}
              onClick={() => {
                if (activeTab?.id !== tab.id) {
                  dispatch(setActiveTab({ tabId: tab.id }));
                }
              }}
              onDragStart={(e) => {
                setDraggedIndex(index);
                e.dataTransfer.effectAllowed = 'move';
              }}
              onDragEnd={() => {
                setDraggedIndex(null);
                setDragOverIndex(null);
              }}
              onDragOver={(e) => {
                e.preventDefault();
                if (draggedIndex !== null && draggedIndex !== index) {
                  setDragOverIndex(index);
                }
              }}
              onDragLeave={() => {
                setDragOverIndex(null);
              }}
              onDrop={(e) => {
                e.preventDefault();
                if (draggedIndex !== null && draggedIndex !== index) {
                  dispatch(reorderTabs({ fromIndex: draggedIndex, toIndex: index }));
                }
                setDraggedIndex(null);
                setDragOverIndex(null);
              }}
            >
              {new DisplayNameHelper(tab.id).getLastDisplayName().removeSuffix().getValue()}
              <button
                className="hover:bg-theme-gray3 rounded px-1 text-xs"
                onClick={(e) => {
                  e.stopPropagation();
                  if (dirtyTabIds.has(tab.id)) {
                    setModalTab(tab.id);
                  } else {
                    dispatch(decreaseTab({ tabId: tab.id }));
                  }
                }}
              >
                {dirtyTabIds.has(tab.id) ? '●' : '×'}
              </button>
            </div>
          ))}
        </div>
        <div
          className="text-sm text-theme-gray5 whitespace-nowrap px-3"
        >
          {(() => {
            return activeTab ? new DisplayNameHelper(activeTab.id).removeSuffix().getValue() : '';
          })()}
        </div>
      </div>
      
      {/* 弹窗处理 */}
      {modalTab && (
        <UnifiedModal
          message="确定关闭吗？存在未保存的更改"
          buttons={[
            { text: '保存', onClick: async () => {
              const tab = tabs.find(t => t.id === modalTab);
              if (tab) {
                try {
                  await api.put(`/api/file/update/${encodeURIComponent(modalTab)}`, { content: tab.content });
                  dispatch(saveTabContent({ id: modalTab }));
                  dispatch(decreaseTab({ tabId: modalTab }));
                  setModalTab(null);
                } catch (error: any) {
                  console.error("保存失败：",error)
                  setModalTab(null)
                  setErrorModal(`保存失败: ${error.message}`);
                }
              }
            }, className: 'bg-theme-green' },
            { text: '丢弃', onClick: () => {
              dispatch(decreaseTab({ tabId: modalTab }));
              setModalTab(null);
            }, className: 'bg-theme-gray5' },
            { text: '取消', onClick: () => {
              setModalTab(null);
            }, className: 'bg-theme-gray3' }
          ]}
        />
      )}

      {/* 错误提示模态框 */}
      {errorModal && (
        <UnifiedModal
          message={errorModal}
          buttons={[
            { text: '确定', onClick: () => {
              setErrorModal(null);
            }, className: 'bg-theme-green' }
          ]}
        />
      )}
    </>
  );
};

export default TabBar
