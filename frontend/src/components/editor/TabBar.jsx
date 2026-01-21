import DisplayNameHelper from "../../utils/DisplayNameHelper";
import { useSelector, useDispatch } from 'react-redux';
import { setActiveTab, decreaseTab } from "../../store/file_editor";
import { useRef, useEffect } from 'react';

// 标签栏组件
const TabBar = () => {
  //@ts-ignore
  const openTabs = useSelector((state)=>state.file_editor.tabId)
  //@ts-ignore
  const activeTabs = useSelector((state)=>state.file_editor.activeTabId)
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
        {openTabs.map(tab => (
          <div
            key={tab}
            className={`px-3 cursor-pointer transition-all border-r border-theme-gray3 whitespace-nowrap flex items-center gap-2 ${activeTabs.includes(tab) ? 'bg-theme-gray2 text-theme-green border-t-1 border-t-theme-green' : 'text-theme-white hover:bg-theme-gray2'}`}
            onClick={() => dispatch(setActiveTab(tab))}
          >
            {new DisplayNameHelper(tab).getLastDisplayName().removeSuffix().getValue()}
            <button
              className="hover:bg-theme-gray3 rounded px-1 text-xs"
              onClick={(e) => {
                e.stopPropagation();
                dispatch(decreaseTab(tab));
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
        {new DisplayNameHelper(activeTabs).removeSuffix().getValue()}
      </div>
    </div>
  )
};

export default TabBar
