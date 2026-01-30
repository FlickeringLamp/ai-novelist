import { useState } from 'react';
import { PanelGroup, Panel, PanelResizeHandle } from 'react-resizable-panels';
import SidebarComponent from './SidebarComponent';
import ProviderSettingsPanel from './aiprovider/ProviderSettingsPanel';
import RagManagementPanel from './rag/RagManagementPanel';
import AgentPanel from './agent/AgentPanel';

interface LayoutComponentProps {
  chapterPanel: React.ReactNode;
  editorPanel: React.ReactNode;
  chatPanel: React.ReactNode;
}

function LayoutComponent({ chapterPanel, editorPanel, chatPanel }: LayoutComponentProps) {
  const [activePanel, setActivePanel] = useState<string | null>(null); // 'api' | 'rag' | 'agent' | null
  const [leftPanelSize, setLeftPanelSize] = useState(15);
  const [rightPanelSize, setRightPanelSize] = useState(25);

  // 处理左侧面板尺寸变化
  const handleLeftPanelChange = (size: number) => {
    setLeftPanelSize(size);
  };

  // 处理右侧面板尺寸变化
  const handleRightPanelChange = (size: number) => {
    setRightPanelSize(size);
  };

  return (
    <div className="flex-grow flex h-full">
      <PanelGroup direction="horizontal" className="flex-grow flex h-full overflow-hidden min-h-0">
        {/* 左侧组件栏 - 固定宽度 */}
        <div className="bg-theme-black p-0 w-[50px] flex-shrink-0 overflow-hidden border-r border-theme-gray3">
          <SidebarComponent activePanel={activePanel} setActivePanel={setActivePanel} />
        </div>
        
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
        
        <PanelResizeHandle className="w-[1px] bg-theme-gray3 cursor-ew-resize flex-shrink-0 relative" />
        
        {/* 编辑器面板 */}
        <Panel
          defaultSize={60}
          minSize={0}
          maxSize={100}
          className="bg-theme-black p-0 flex flex-col h-full overflow-hidden"
        >
          {editorPanel}
        </Panel>

        <PanelResizeHandle className="w-[1px] bg-theme-gray3 cursor-ew-resize flex-shrink-0 relative" />
        
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
        <div className="fixed top-0 left-[51px] right-0 bottom-0 bg-theme-black z-[1000]">
          {activePanel === 'api' && (
            <ProviderSettingsPanel
            // @ts-ignore
              isOpen={true}
              onClose={() => setActivePanel(null)}
            />
          )}
          {activePanel === 'rag' && (
            <RagManagementPanel
            // @ts-ignore
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
