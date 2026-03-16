import { useState, useRef, useEffect } from 'react';
import { PanelGroup, Panel, PanelResizeHandle, type ImperativePanelHandle } from 'react-resizable-panels';
import { useDispatch } from 'react-redux';
import { addTab, setActiveTab } from '../store/editor';
import SidebarComponent from './SidebarComponent';
import ProviderSettingsPanel from './aiprovider/ProviderSettingsPanel';
import RagManagementPanel from './rag/KnowledgeBasePanel';
import AgentPanel from './agent/AgentPanel';
import MCPSettingsPanel from './mcp/MCPSettingsPanel';
import TopActionBar from './others/TopActionBar';
import SearchPanel from './search/SearchPanel';
import CheckpointPanel from './checkpoint/CheckpointPanel';
import { TerminalPanel } from './terminal';
import httpClient from '../utils/httpClient';

interface LayoutComponentProps {
  chapterPanel: React.ReactNode;
  editorPanel: React.ReactNode;
  chatPanel: React.ReactNode;
}

function LayoutComponent({ chapterPanel, editorPanel, chatPanel }: LayoutComponentProps) {
  const dispatch = useDispatch();
  const [activePanel, setActivePanel] = useState<string | null>(null);
  const [isLeftPanelCollapsed, setIsLeftPanelCollapsed] = useState(false);
  const [leftPanelContent, setLeftPanelContent] = useState<'chapter' | 'search' | 'checkpoint'>('chapter');
  const [leftPanelSize, setLeftPanelSize] = useState(15);
  const [rightPanelSize, setRightPanelSize] = useState(25);
  const [isTerminalVisible, setIsTerminalVisible] = useState(false);
  const leftPanelRef = useRef<ImperativePanelHandle>(null);

  // 同步折叠状态
  useEffect(() => {
    if (leftPanelRef.current) {
      if (isLeftPanelCollapsed) {
        leftPanelRef.current.collapse();
      } else {
        leftPanelRef.current.expand();
      }
    }
  }, [isLeftPanelCollapsed]);

  // 处理左侧面板尺寸变化
  const handleLeftPanelChange = (size: number) => {
    setLeftPanelSize(size);
  };

  // 处理右侧面板尺寸变化
  const handleRightPanelChange = (size: number) => {
    setRightPanelSize(size);
  };

  // 切换左侧面板折叠状态
  const handleToggleCollapse = () => {
    setIsLeftPanelCollapsed(prev => !prev);
  };

  // 切换左侧面板内容
  const handleLeftPanelContentChange = (content: 'chapter' | 'search' | 'checkpoint') => {
    setLeftPanelContent(content);
    if (isLeftPanelCollapsed) {
      setIsLeftPanelCollapsed(false);
    }
  };

  // 切换终端面板显示
  const handleToggleTerminal = () => {
    setIsTerminalVisible(prev => !prev);
  };

  // 监听键盘快捷键
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Ctrl+` 切换终端
      if (event.ctrlKey && event.key === '`') {
        event.preventDefault();
        handleToggleTerminal();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // 处理搜索结果中的文件选择
  const handleFileSelect = async (filePath: string) => {
    try {
      const response = await httpClient.get(`/api/file/read/${filePath}`);
      dispatch(addTab({ id: response.id, content: response.content }));
      dispatch(setActiveTab({ tabId: filePath }));
    } catch (error) {
      console.error('获取文件内容失败:', error);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <TopActionBar
        isLeftPanelCollapsed={isLeftPanelCollapsed}
        leftPanelContent={leftPanelContent}
        onToggleCollapse={handleToggleCollapse}
        onLeftPanelContentChange={handleLeftPanelContentChange}
        isTerminalVisible={isTerminalVisible}
        onToggleTerminal={handleToggleTerminal}
      />
      <div className="h-[97%] flex-grow flex">
        <PanelGroup direction="vertical" className="flex-grow flex h-full overflow-hidden min-h-0">
          {/* 上部区域：现有三栏布局 */}
          <Panel 
            defaultSize={isTerminalVisible ? 75 : 100} 
            minSize={30}
            className="flex flex-col"
          >
            <PanelGroup direction="horizontal" className="flex-grow flex h-full overflow-hidden min-h-0">
              {/* 左侧组件栏 - 固定宽度 */}
              <div className="bg-theme-black p-0 w-[50px] flex-shrink-0 overflow-hidden border-r border-theme-gray3">
                <SidebarComponent
                  activePanel={activePanel}
                  setActivePanel={setActivePanel}
                />
              </div>
              
              {/* 左侧面板 - 章节列表或搜索面板 */}
              <Panel
                ref={leftPanelRef}
                defaultSize={leftPanelSize}
                minSize={0}
                maxSize={100}
                collapsible={true}
                onResize={handleLeftPanelChange}
                onCollapse={() => setIsLeftPanelCollapsed(true)}
                onExpand={() => setIsLeftPanelCollapsed(false)}
                className="bg-theme-black p-0"
              >
                {leftPanelContent === 'chapter' && chapterPanel}
                {leftPanelContent === 'search' && (
                  <SearchPanel
                    onFileSelect={handleFileSelect}
                    embedded={true}
                  />
                )}
                {leftPanelContent === 'checkpoint' && (
                  <CheckpointPanel />
                )}
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
                defaultSize={rightPanelSize}
                minSize={0}
                maxSize={100}
                className="bg-theme-black p-0 flex flex-col h-full overflow-hidden"
                onResize={handleRightPanelChange}
              >
                {chatPanel}
              </Panel>
            </PanelGroup>
          </Panel>

          {/* 终端面板 */}
          {isTerminalVisible && (
            <>
              <PanelResizeHandle className="h-[2px] bg-theme-gray3 hover:bg-theme-green cursor-ns-resize" />
              <Panel
                defaultSize={25}
                minSize={10}
                maxSize={60}
                className="bg-theme-black"
              >
                <TerminalPanel isVisible={isTerminalVisible} />
              </Panel>
            </>
          )}
        </PanelGroup>

        {/* 设置面板 - 全屏覆盖 */}
        {activePanel && (
          <div className="fixed top-[3%] left-[51px] right-0 bottom-0 bg-theme-black z-[1000]">
            {activePanel === 'api' && (
              <ProviderSettingsPanel />
            )}
            {activePanel === 'rag' && (
              <RagManagementPanel />
            )}
            {activePanel === 'agent' && (
              <AgentPanel />
            )}
            {activePanel === 'mcp' && (
              <MCPSettingsPanel />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default LayoutComponent;
