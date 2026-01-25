import { useSelector } from 'react-redux';
import { useEffect, useState } from 'react';
import { getTabBar, type RootState } from "../../../store/editor.ts";
import MonacoEditor from './CoreEditor.tsx';
import StatusBar from './StatusBar.tsx';
import EditorLogo from '../../others/Logo.tsx';

const TabBarEditorArea = ({ tabBarId }: { tabBarId: string }) => {
  const tabBar = useSelector((state: RootState) => getTabBar(state, tabBarId));
  const activeTab = tabBar?.tabs.find((tab: string) => tab === tabBar?.activeTabId);
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

  return (
    <div className="flex-1 flex flex-col min-w-0">
      <div className="flex-1 min-h-0">
        {hasActiveTab ? (
          <MonacoEditor 
          onChange={handleEditorChange} 
          tabBarId={tabBarId}
          />
        ) : (
          <EditorLogo />
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
