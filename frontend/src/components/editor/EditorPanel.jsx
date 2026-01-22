import { useState } from 'react';
import { useSelector } from 'react-redux';
import TabBar from './TabBar.jsx';
import MonacoEditor from './MonacoEditor.jsx';
import StatusBar from './StatusBar.jsx';
import EditorLogo from './EditorLogo.jsx';

// 主编辑器面板组件
function EditorPanel() {
  const [charCount, setCharCount] = useState(0);
  // @ts-ignore
  const tabs = useSelector((state) => state.editor.tabs);
  const activeTab = tabs.find(tab => tab.isActived);
  const hasActiveTab = !!activeTab;

  const handleEditorChange = (value) => {
    if (value !== undefined) {
      setCharCount(value.length);
    }
  };

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
      <div className='h-[2%]'>
        <StatusBar charCount={charCount}/>
      </div>
    </div>
  );
}

export default EditorPanel;
