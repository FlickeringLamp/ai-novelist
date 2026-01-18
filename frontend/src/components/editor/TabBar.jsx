import getDisplayName from "../../utils/getDisplayName";
import { useSelector, useDispatch } from 'react-redux';
import { setActiveTab } from "../../store/file_editor";
import './TabBar.css';

// 标签栏组件
const TabBar = () => {
  //@ts-ignore
  const openTabs = useSelector((state)=>state.file_editor.tabId)
  //@ts-ignore
  const activeTabs = useSelector((state)=>state.file_editor.activeTabId)
  const dispatch = useDispatch()
  console.log("是否加载了标签栏")
  return(
    <div className="tab_bar">
      {openTabs.map(tab => (
        <div
          key={tab}
          className={`tab ${activeTabs.includes(tab) ? 'active' : ''}`}
          onClick={() => dispatch(setActiveTab(tab))}
        >
          {getDisplayName(tab)}
        </div>
      ))}
    </div>
  )
};

export default TabBar