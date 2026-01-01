import React, { useCallback, useState, useEffect } from 'react';
import { PanelGroup, Panel, PanelResizeHandle } from 'react-resizable-panels';
import EditorPanel from './EditorPanel';
import './SplitViewPanel.css';
import tabStateService from '../../services/tabStateService';

function SplitViewPanel() {
  const [openTabs, setOpenTabs] = useState(tabStateService.getOpenTabs());
  const [splitView, setSplitView] = useState(tabStateService.getSplitView());

  useEffect(() => {
    const handleStateChange = (event) => {
      setOpenTabs(event.detail.openTabs);
      setSplitView(event.detail.splitView);
    };

    tabStateService.addEventListener('stateChanged', handleStateChange);

    return () => {
      tabStateService.removeEventListener('stateChanged', handleStateChange);
    };
  }, []);

  const leftTab = openTabs.find(tab => tab.id === splitView.leftTabId);
  const rightTab = openTabs.find(tab => tab.id === splitView.rightTabId);

  const handleCloseSplitView = useCallback(() => {
    tabStateService.disableSplitView();
  }, []);

  const handleTabSwap = useCallback(() => {
    if (splitView.leftTabId && splitView.rightTabId) {
      tabStateService.setSplitViewTabs(splitView.rightTabId, splitView.leftTabId);
    }
  }, [splitView.leftTabId, splitView.rightTabId]);

  const handleTabSelect = useCallback((side, tabId) => {
    if (side === 'left') {
      tabStateService.setSplitViewTabs(tabId, splitView.rightTabId);
    } else {
      tabStateService.setSplitViewTabs(splitView.leftTabId, tabId);
    }
  }, [splitView.leftTabId, splitView.rightTabId]);

  if (!splitView.enabled) {
    return null;
  }

  const isHorizontal = splitView.layout === 'horizontal';

  return (
    <div className="split-view-container">
      <div className="split-view-header">
        <div className="split-view-controls">
          <button 
            className="split-view-button"
            onClick={handleTabSwap}
            title="交换左右面板"
          >
            ⇄
          </button>
          <button 
            className="split-view-button"
            onClick={handleCloseSplitView}
            title="关闭分屏"
          >
            ✕
          </button>
        </div>
        <div className="split-view-tabs">
          <div className="split-tab-selector">
            <select 
              value={splitView.leftTabId || ''}
              onChange={(e) => handleTabSelect('left', e.target.value)}
              className="tab-select"
            >
              <option value="">选择左侧文件</option>
              {openTabs.map(tab => (
                <option key={tab.id} value={tab.id} disabled={tab.id === splitView.rightTabId}>
                  {tab.title}
                </option>
              ))}
            </select>
          </div>
          <div className="split-tab-selector">
            <select 
              value={splitView.rightTabId || ''}
              onChange={(e) => handleTabSelect('right', e.target.value)}
              className="tab-select"
            >
              <option value="">选择右侧文件</option>
              {openTabs.map(tab => (
                <option key={tab.id} value={tab.id} disabled={tab.id === splitView.leftTabId}>
                  {tab.title}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <PanelGroup 
        direction={isHorizontal ? 'horizontal' : 'vertical'} 
        className={`split-view-panels ${isHorizontal ? 'horizontal' : 'vertical'}`}
      >
        {/* 左侧面板 */}
        <Panel
          defaultSize={50}
          minSize={20}
          className="split-panel left-panel"
        >
          {leftTab ? (
            <div className="split-editor-container">
              <div className="panel-header">
                <span className="panel-title">{leftTab.title}</span>
              </div>
              <div className="editor-wrapper">
                <EditorPanel splitViewTabId={splitView.leftTabId} />
              </div>
            </div>
          ) : (
            <div className="no-file-selected">
              <p>请选择左侧文件</p>
            </div>
          )}
        </Panel>

        <PanelResizeHandle className="split-resize-handle">
          <div className="resize-handle-inner" />
        </PanelResizeHandle>

        {/* 右侧面板 */}
        <Panel
          defaultSize={50}
          minSize={20}
          className="split-panel right-panel"
        >
          {rightTab ? (
            <div className="split-editor-container">
              <div className="panel-header">
                <span className="panel-title">{rightTab.title}</span>
              </div>
              <div className="editor-wrapper">
                <EditorPanel splitViewTabId={splitView.rightTabId} />
              </div>
            </div>
          ) : (
            <div className="no-file-selected">
              <p>请选择右侧文件</p>
            </div>
          )}
        </Panel>
      </PanelGroup>
    </div>
  );
}

export default SplitViewPanel;