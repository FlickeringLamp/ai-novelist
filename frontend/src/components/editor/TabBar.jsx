import DisplayNameHelper from "../../utils/DisplayNameHelper";
import { useSelector, useDispatch } from 'react-redux';
import { exchangeActiveTab, decreaseTab, addActiveTab } from "../../store/editor";
import { useRef, useEffect } from 'react';

// 标签栏组件
const TabBar = () => {
  //@ts-ignore
  const tabs = useSelector((state)=>state.editor.tabs)
  const dispatch = useDispatch()
  const scrollContainerRef = useRef(null);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const handleWheel = (e) => {
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


  return(
    <div className="bg-theme-gray1 h-full flex flex-col border-b border-theme-gray3">
      <div
        ref={scrollContainerRef}
        className="flex overflow-x-auto border-b border-theme-gray3 h-[60%]"
      >
        {tabs.map(tab => (
          <div
            key={tab.id}
            className={`px-3 cursor-pointer transition-all border-r border-theme-gray3 whitespace-nowrap flex items-center gap-2 ${tab.isActived ? 'bg-theme-gray2 text-theme-green border-t-1 border-t-theme-green' : 'text-theme-white hover:bg-theme-gray2'}`}
            onClick={() => {
              const activeTab = tabs.find(t => t.isActived);
              
              if (!activeTab) {
                dispatch(addActiveTab(tab.id));
              } else if (activeTab.id !== tab.id) {
                dispatch(exchangeActiveTab([activeTab.id, tab.id]));
              }
            }}
          >
            {new DisplayNameHelper(tab.id).getLastDisplayName().removeSuffix().getValue()}
            <button
              className="hover:bg-theme-gray3 rounded px-1 text-xs"
              onClick={(e) => {
                e.stopPropagation();
                dispatch(decreaseTab(tab.id));
              }}
            >
              ×
            </button>
          </div>
        ))}
      </div>
      <div
        className="text-sm text-theme-gray5 whitespace-nowrap px-3"
      >
        {(() => {
          const activeTab = tabs.find(tab => tab.isActived);
          return activeTab ? new DisplayNameHelper(activeTab.id).removeSuffix().getValue() : '';
        })()}
      </div>
    </div>
  )
};

export default TabBar
