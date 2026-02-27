import { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { setAllServersData } from '../../store/mcp';
import ServerListPanel from './ServerListPanel';
import ServerDetailPanel from './ServerDetailPanel';
import httpClient from '../../utils/httpClient';

const MCPSettingsPanel = () => {
  const dispatch = useDispatch();

  // 挂载时从后端获取MCP服务器数据
  useEffect(() => {
    const fetchServers = async () => {
      try {
        const result = await httpClient.get('/api/mcp/servers');
        if (result) {
          dispatch(setAllServersData(result));
        }
      } catch (error) {
        console.error('加载MCP服务器失败:', error);
      }
    };
    fetchServers();
  }, []);

  return (
    <div className="w-full h-full">
      <PanelGroup direction="horizontal" className="flex-grow flex h-full overflow-hidden min-h-0">
        {/* 左侧服务器列表面板 */}
        <ServerListPanel />
        <PanelResizeHandle className="w-[1px] bg-theme-gray3 cursor-col-resize relative" />
        {/* 右侧服务器详情面板 */}
        <ServerDetailPanel />
      </PanelGroup>
    </div>
  );
};

export default MCPSettingsPanel;
