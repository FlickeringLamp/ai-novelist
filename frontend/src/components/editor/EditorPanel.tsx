import { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import TabBar from './TabBar.tsx';
import MonacoEditor from './MonacoEditor.tsx';
import StatusBar from './StatusBar.tsx';
import EditorLogo from '../others/Logo.tsx';
import type { RootState } from '../../store/editor.ts';

interface Tab {
  id: string;
  content: string;
}

// 主编辑器面板组件
function EditorPanel() {
  const [charCount, setCharCount] = useState(0);
  const activeTabBarId = useSelector((state: RootState) => state.tabSlice.activeTabBarId);
  const tabBar = useSelector((state: RootState) => state.tabSlice.tabBars[activeTabBarId]);
  const tabs = tabBar?.tabs || [];
  const activeTabId = tabBar?.activeTabId;
  const activeTab = tabs.find((tab: Tab) => tab.id === activeTabId);
  const hasActiveTab = !!activeTab;

  const handleEditorChange = (value: string | undefined) => {
    if (value !== undefined) {
      // 过滤掉所有空白字符（空格、换行符、制表符等）
      const nonWhitespaceCount = value.replace(/\s/g, '').length;
      setCharCount(nonWhitespaceCount);
    }
  };

  // 当activeTab变化时，重新计算字数
  useEffect(() => {
    if (activeTab && activeTab.content !== undefined) {
      const nonWhitespaceCount = activeTab.content.replace(/\s/g, '').length;
      setCharCount(nonWhitespaceCount);
    } else {
      setCharCount(0);
    }
  }, [activeTab]);

  return (
    <div
      className='h-full'
    >
      <div
        className='h-[5%]'
      >
        <TabBar/>
      </div>
      <div className='h-[93%]'>
        {hasActiveTab ? (
          // 有活跃标签时显示编辑器
          // @ts-ignore
          <MonacoEditor onChange={handleEditorChange} />
        ) : (
          // 无活跃标签时显示Logo
          <EditorLogo />
        )}
      </div>
      {hasActiveTab && (
        <div className='h-[2%]'>
          <StatusBar charCount={charCount}/>
        </div>
      )}
    </div>
  );
}

export default EditorPanel;
