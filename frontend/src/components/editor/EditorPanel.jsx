import TabBar from './TabBar.jsx';
import MonacoEditor from './MonacoEditor.jsx';
// 主编辑器面板组件
function EditorPanel() {

  return (
    <div
      className='h-full'
    >
      <div
        className='h-[5%]'
      >
        <TabBar/>
      </div>
      <div className='h-[95%]'>
        <MonacoEditor/>
      </div>
    </div>
  );
}

export default EditorPanel;
