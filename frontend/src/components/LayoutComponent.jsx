import { useState } from 'react';
import { PanelGroup, Panel, PanelResizeHandle } from 'react-resizable-panels';
import SidebarComponent from './SidebarComponent';
import ProviderSettingsPanel from './aiprovider/ProviderSettingsPanel';
import RagManagementPanel from './rag/RagManagementPanel';
import AgentPanel from './agent/AgentPanel';

function LayoutComponent({ chapterPanel, editorPanel, chatPanel }) {
  const [activePanel, setActivePanel] = useState(null); // 'api' | 'rag' | 'agent' | null
  const [leftPanelSize, setLeftPanelSize] = useState(20);
  const [rightPanelSize, setRightPanelSize] = useState(20);

  // 处理左侧面板尺寸变化
  const handleLeftPanelChange = (size) => {
    setLeftPanelSize(size);
  };

  // 处理右侧面板尺寸变化
  const handleRightPanelChange = (size) => {
    setRightPanelSize(size);
  };

  return (
    <div className="flex-grow flex h-full">
      <PanelGroup direction="horizontal" className="flex-grow flex h-full overflow-hidden min-h-0">
        {/* 左侧组件栏 - 固定宽度图标栏，不能拖动 */}
        <div className="bg-theme-black p-0 w-[50px] flex-shrink-0 overflow-hidden">
          <SidebarComponent activePanel={activePanel} setActivePanel={setActivePanel} />
        </div>
        
        {/* 细长的普通灰色分隔线 */}
        <div className="w-[1px] bg-theme-gray1 flex-shrink-0"></div>
        
        {/* 章节面板 */}
        <Panel
          defaultSize={leftPanelSize} /* 使用 defaultSize 允许用户拖动 */
          minSize={0} /* 允许完全隐藏 */
          maxSize={100} /* 允许全范围拖动 */
          className="bg-theme-black p-0"
          onResize={handleLeftPanelChange} /* 监听尺寸变化 */
        >
          {chapterPanel}
        </Panel>
        <PanelResizeHandle className="w-[1px] bg-theme-gray1 cursor-ew-resize flex-shrink-0 relative" />
        
        {/* 编辑器面板 */}
        <Panel
          defaultSize={60}
          minSize={0}
          maxSize={100}
          className="bg-theme-black p-0 flex flex-col h-full overflow-hidden"
        >
          {editorPanel}
        </Panel>
        <PanelResizeHandle className="w-[1px] bg-theme-gray1 cursor-ew-resize flex-shrink-0 relative" />
        
        {/* 聊天面板 */}
        <Panel
          defaultSize={rightPanelSize} /* 使用 defaultSize 允许用户拖动 */
          minSize={0} /* 允许完全隐藏 */
          maxSize={100} /* 允许全范围拖动 */
          className="bg-theme-black p-0 flex flex-col h-full overflow-hidden"
          onResize={handleRightPanelChange} /* 监听尺寸变化 */
        >
          {chatPanel}
        </Panel>
      </PanelGroup>

      {/* 设置面板 - 全屏覆盖 */}
      {activePanel && (
        <div className="fixed top-0 left-[50px] right-0 bottom-0 bg-theme-black z-[1000] overflow-auto">
          {activePanel === 'api' && (
            <ProviderSettingsPanel
              isOpen={true}
              onClose={() => setActivePanel(null)}
            />
          )}
          {activePanel === 'rag' && (
            <RagManagementPanel
              isOpen={true}
              onClose={() => setActivePanel(null)}
            />
          )}
          {activePanel === 'agent' && (
            <AgentPanel
              isOpen={true}
              onClose={() => setActivePanel(null)}
            />
          )}
        </div>
      )}
    </div>
  );
}

export default LayoutComponent;
