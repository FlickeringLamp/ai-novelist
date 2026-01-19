import getDisplayName from "../../utils/getDisplayName";
import { useSelector, useDispatch } from 'react-redux';
import { setActiveTab } from "../../store/file_editor";

// 标签栏组件
const TabBar = () => {
  //@ts-ignore
  const openTabs = useSelector((state)=>state.file_editor.tabId)
  //@ts-ignore
  const activeTabs = useSelector((state)=>state.file_editor.activeTabId)
  const dispatch = useDispatch()
  console.log("是否加载了标签栏")
  return(
    <div className="flex items-center gap-1 bg-theme-gray1 border-b border-theme-gray1 overflow-x-auto">
      {openTabs.map(tab => (
        <div
          key={tab}
          className={`px-3 py-2 cursor-pointer transition-all border-r border-theme-gray1 whitespace-nowrap ${activeTabs.includes(tab) ? 'bg-theme-black text-theme-white border-t-2 border-t-theme-green' : 'text-theme-white hover:bg-theme-gray1/80'}`}
          onClick={() => dispatch(setActiveTab(tab))}
        >
          {getDisplayName(tab)}
        </div>
      ))}
    </div>
  )
};

export default TabBar