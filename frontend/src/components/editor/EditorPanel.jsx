import { useState } from 'react';
import TabBar from './TabBar.jsx';
import getDisplayName from '../../utils/getDisplayName.js';
import EditorLifecycleManager from './editorLifecycleManager.js';
import MonacoDiffViewer from './MonacoDiffViewer.jsx';
import MonacoEditor from './MonacoEditor.jsx';
import { useSelector } from 'react-redux';

// 主编辑器面板组件
function EditorPanel() {
  const [showModal, setShowModal] = useState(false);
  const [modalMessage, setModalMessage] = useState('');
  //@ts-ignore
  const openTabs = useSelector((state)=>state.file_editor.tabId)
  //@ts-ignore
  const activateTabs = useSelector((state)=>state.file_editor.activeTabId)

  const registerEditorInstance = (tabId, editorInstance) => {
    if (tabId && editorInstance) {
      // @ts-ignore
      EditorLifecycleManager.registerEditor(tabId, editorInstance);
    }
  };

  return (
    <>
      <TabBar/>
    </>
  );
}

export default EditorPanel;
