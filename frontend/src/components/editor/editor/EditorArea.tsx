import { useSelector } from 'react-redux';
import { useEffect, useState } from 'react';
import { PanelGroup, Panel, PanelResizeHandle } from 'react-resizable-panels';
import { type RootState as EditorRootState, type TabBar } from "../../../store/editor.ts";
import type { RootState } from "../../../store/store";
import MonacoEditor from './CoreEditor.tsx';
import StatusBar from './StatusBar.tsx';
import { TerminalPanel } from '../../terminal';

interface TabBarEditorAreaProps {
  tabBarId: string;
  tabBar: TabBar;
}

/**不知为什么，关闭最后一个活跃标签时，被监听的tabSlice根本不更新, 导致始终无法显示logo
 * 依赖换成tabslice都没用。
 * hasActiveTab始终为true，
 * 故将logo移动到外层(外层editorpanel能正常更新)
 * 推测与组件结构（这是父组件遍历出来的子组件之一）有关，可能也与redux特性有关
 */
const TabBarEditorArea = ({ tabBarId, tabBar }: TabBarEditorAreaProps) => {
  const activeTab = tabBar.activeTabId
  const hasActiveTab = !!activeTab;
  const isTerminalVisible = useSelector((state: RootState) => state.terminalSlice.isVisible);
  const currentData = useSelector((state: EditorRootState) => state.tabSlice.currentData);
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
    <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
      <PanelGroup direction="vertical" className="h-full">
        {/* 编辑器区域 */}
        <Panel
          id="editor"
          order={1}
          defaultSize={isTerminalVisible ? 80 : 100}
          className="flex flex-col min-h-0"
        >
          <div className="flex-1 min-h-0 overflow-hidden">
            {hasActiveTab &&(
              <MonacoEditor
              onChange={handleEditorChange}
              tabBarId={tabBarId}
              />
            )}
          </div>
          {hasActiveTab && (
            <div className="h-6 flex-shrink-0">
              <StatusBar charCount={charCount} />
            </div>
          )}
        </Panel>

        {/* 终端面板 */}
        {isTerminalVisible && (
          <>
            <PanelResizeHandle className="h-[1px] bg-theme-gray3 hover:bg-theme-green cursor-ns-resize flex-shrink-0" />
            <Panel
              id="terminal"
              order={2}
              defaultSize={20}
              className="bg-theme-black flex flex-col min-h-0 overflow-hidden"
            >
              <TerminalPanel />
            </Panel>
          </>
        )}
      </PanelGroup>
    </div>
  );
};

export default TabBarEditorArea;
