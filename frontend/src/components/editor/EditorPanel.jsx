import { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import TabBar from './TabBar.jsx';
import MonacoEditor from './MonacoEditor.jsx';
import StatusBar from './StatusBar.jsx';
import EditorLogo from './EditorLogo.jsx';

// 主编辑器面板组件
function EditorPanel() {
  const [charCount, setCharCount] = useState(0);
  //@ts-ignore
  const tabs = useSelector((state) => state.tabSlice.tabsA);
  const activeTab = tabs.find(tab => tab.isActived);
  const hasActiveTab = !!activeTab;

  const handleEditorChange = (value) => {
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
