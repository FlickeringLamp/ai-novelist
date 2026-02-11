import { useSelector } from 'react-redux';
import { useEffect, useState } from 'react';
import { type RootState, type TabBar } from "../../../store/editor.ts";
import MonacoEditor from './CoreEditor.tsx';
import StatusBar from './StatusBar.tsx';

/**不知为什么，关闭最后一个活跃标签时，被监听的tabSlice根本不更新, 导致始终无法显示logo
 * 依赖换成tabslice都没用。
 * hasActiveTab始终为true，
 * 故将logo移动到外层(外层editorpanel能正常更新)
 * 推测与组件结构（这是父组件遍历出来的子组件之一）有关，可能也与redux特性有关
 */
const TabBarEditorArea = ({ tabBarId, tabBar }: { tabBarId: string, tabBar:TabBar }) => {
  const activeTab = tabBar.activeTabId
  const hasActiveTab = !!activeTab;
  const currentData = useSelector((state: RootState) => state.tabSlice.currentData);
  const [charCount, setCharCount] = useState(0);

  const handleEditorChange = (value: string | undefined) => {
    if (value !== undefined) {
      const nonWhitespaceCount = value.replace(/\s/g, '').length;
      setCharCount(nonWhitespaceCount);
    }
  };

  useEffect(() => {
    if (activeTab && currentData[activeTab] !== undefined) {
      const nonWhitespaceCount = currentData[activeTab].replace(/\s/g, '').length;
      setCharCount(nonWhitespaceCount);
    } else {
      setCharCount(0);
    }
  }, [activeTab, currentData]);

  // useEffect(()=>{
  //   console.log("总状态：", tabBar)
  // },[tabBar])

  // useEffect(()=>{
  //   console.log("logo前提：有无标签", hasActiveTab, "activeTab:", activeTab)
  // },[hasActiveTab, activeTab])

  return (
    <div className="flex-1 flex flex-col min-w-0">
      <div className="flex-1 min-h-0">
        {hasActiveTab &&(
          <MonacoEditor 
          onChange={handleEditorChange} 
          tabBarId={tabBarId}
          />
        )}
      </div>
      {hasActiveTab && (
        <div className="h-6">
          <StatusBar charCount={charCount} />
        </div>
      )}
    </div>
  );
};

export default TabBarEditorArea;
