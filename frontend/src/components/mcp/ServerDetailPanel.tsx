import { useEffect } from 'react';
import { Panel } from 'react-resizable-panels';
import { useSelector, useDispatch } from 'react-redux';
import type { RootState } from '../../store/store';
import {
  setTools,
  setLoading,
} from '../../store/mcp';
import httpClient from '../../utils/httpClient';

interface ServerDetailPanelProps {}

const ServerDetailPanel = ({}: ServerDetailPanelProps) => {
  const dispatch = useDispatch();

  // 从 Redux 获取数据
  const selectedServerId = useSelector((state: RootState) => state.mcpSlice.selectedServerId);
  const serversData = useSelector((state: RootState) => state.mcpSlice.allServersData);
  const tools = useSelector((state: RootState) => state.mcpSlice.tools);
  const isLoading = useSelector((state: RootState) => state.mcpSlice.isLoading);

  // 加载MCP工具列表
  const loadMCPTools = async () => {
    try {
      dispatch(setLoading(true));
      const result = await httpClient.get('/api/mcp/tools');
      dispatch(setTools(result));
    } catch (error) {
      console.error('加载MCP工具失败:', error);
    } finally {
      dispatch(setLoading(false));
    }
  };

  // 获取当前选中的服务器
  const selectedServer = selectedServerId ? serversData[selectedServerId] : null;

  return (
    <Panel defaultSize={85} minSize={0} maxSize={100} className="p-4 h-full overflow-y-auto">
      {!selectedServer ? (
        <div className="flex items-center justify-center h-full text-theme-gray4">
          <p>请选择一个MCP服务器查看详情</p>
        </div>
      ) : (
        <>
          {/* 服务器详情 */}
          <div className="mb-5 p-3 border border-theme-gray3 rounded">
            <h3 className="text-white text-base font-medium mb-3">服务器详情</h3>
            <div className="space-y-2">
              <div>
                <span className="text-theme-gray4 text-sm">名称:</span>
                <span className="ml-2 text-white">{selectedServer.name}</span>
              </div>
              <div>
                <span className="text-theme-gray4 text-sm">描述:</span>
                <span className="ml-2 text-white">{selectedServer.description || '无描述'}</span>
              </div>
              <div>
                <span className="text-theme-gray4 text-sm">类型:</span>
                <span className="ml-2 text-white">{selectedServer.transport}</span>
              </div>
              <div>
                <span className="text-theme-gray4 text-sm">状态:</span>
                <span className={`ml-2 ${selectedServer.isActive ? 'text-theme-green' : 'text-theme-gray4'}`}>
                  {selectedServer.isActive ? '激活' : '未激活'}
                </span>
              </div>
              {selectedServer.transport === 'stdio' && (
                <>
                  <div>
                    <span className="text-theme-gray4 text-sm">命令:</span>
                    <span className="ml-2 text-white">{selectedServer.command || '无'}</span>
                  </div>
                  <div>
                    <span className="text-theme-gray4 text-sm">参数:</span>
                    <span className="ml-2 text-white">{selectedServer.args?.join(' ') || '无'}</span>
                  </div>
                </>
              )}
              {selectedServer.transport === 'http' && (
                <div>
                  <span className="text-theme-gray4 text-sm">Base URL:</span>
                  <span className="ml-2 text-white">{selectedServer.baseUrl || '无'}</span>
                </div>
              )}
              {selectedServer.env && Object.keys(selectedServer.env).length > 0 && (
                <div>
                  <span className="text-theme-gray4 text-sm">环境变量:</span>
                  <div className="ml-2 mt-1 space-y-1">
                    {Object.entries(selectedServer.env).map(([key, value]) => (
                      <div key={key} className="text-sm text-white">
                        {key}={value}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 工具列表 */}
          <div>
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-white text-base font-medium">MCP工具列表</h3>
              <button 
                onClick={loadMCPTools} 
                disabled={isLoading}
                className={`px-3 py-1 rounded transition-colors ${
                  isLoading 
                    ? 'bg-theme-gray3 text-theme-gray5 cursor-not-allowed' 
                    : 'bg-theme-green text-black hover:bg-theme-green1'
                }`}
              >
                {isLoading ? '加载中...' : '刷新工具'}
              </button>
            </div>
            {Object.keys(tools).length === 0 ? (
              <p className="text-theme-gray4">暂无MCP工具</p>
            ) : (
              <ul className="list-none p-0 m-0 space-y-2">
                {Object.entries(tools).map(([name, tool]) => (
                  <li
                    key={name}
                    className="p-2 border border-theme-gray3 rounded hover:bg-theme-gray2 transition-colors"
                  >
                    <strong className="text-white block">{name}</strong>
                    <div className="text-xs text-theme-gray4 mt-1">
                      {tool.description || '无描述'}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </Panel>
  );
};

export default ServerDetailPanel;
