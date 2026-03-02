import { useState, useEffect } from 'react';
import { Panel } from 'react-resizable-panels';
import { useSelector, useDispatch } from 'react-redux';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faRotate, faChevronDown } from '@fortawesome/free-solid-svg-icons';
import type { RootState } from '../../store/store';
import {
  setTools,
  setLoading,
  setAllServersData,
} from '../../store/mcp';
import httpClient from '../../utils/httpClient';

// 解析环境变量字符串为对象
const parseEnvString = (str: string): Record<string, string> => {
  const result: Record<string, string> = {};
  const pairs = str.trim().split(/\s+/);
  for (const pair of pairs) {
    const [key, ...valueParts] = pair.split('=');
    if (key) {
      result[key] = valueParts.join('=') || '';
    }
  }
  return result;
};

// 将对象转换为环境变量字符串
const envToString = (env: Record<string, string> | undefined): string => {
  if (!env) return '';
  return Object.entries(env)
    .map(([key, value]) => `${key}=${value}`)
    .join(' ');
};

interface ServerDetailPanelProps {}

const ServerDetailPanel = ({}: ServerDetailPanelProps) => {
  const dispatch = useDispatch();

  // 从 Redux 获取数据
  const selectedServerId = useSelector((state: RootState) => state.mcpSlice.selectedServerId);
  const serversData = useSelector((state: RootState) => state.mcpSlice.allServersData);
  const tools = useSelector((state: RootState) => state.mcpSlice.tools);
  const isLoading = useSelector((state: RootState) => state.mcpSlice.isLoading);

  // 编辑状态
  const [showTransportDropdown, setShowTransportDropdown] = useState(false);

  // 当切换服务器时自动加载工具列表
  useEffect(() => {
    if (selectedServerId) {
      loadMCPTools();
    }
  }, [selectedServerId]);

  // 加载MCP工具列表
  const loadMCPTools = async () => {
    if (!selectedServerId) {
      return;
    }
    try {
      dispatch(setLoading(true));
      const result = await httpClient.get(`/api/mcp/tools?server_id=${selectedServerId}`);
      dispatch(setTools(result));
    } catch (error) {
      console.error('加载MCP工具失败:', error);
    } finally {
      dispatch(setLoading(false));
    }
  };

  // 切换服务器启用/禁用状态
  const handleToggleServer = async () => {
    if (!selectedServerId) return;

    const newActiveState = !selectedServer?.isActive;

    try {
      await httpClient.put(`/api/mcp/servers/${selectedServerId}`, {
        server_id: selectedServerId,
        config: {
          isActive: newActiveState
        }
      });

      // 刷新服务器列表
      const serversResult = await httpClient.get('/api/mcp/servers');
      dispatch(setAllServersData(serversResult));
    } catch (error) {
      console.error('更新服务器状态失败:', error);
    }
  };

  // 更新服务器配置
  const updateServerConfig = async (config: Record<string, any>) => {
    if (!selectedServerId) return;

    try {
      await httpClient.put(`/api/mcp/servers/${selectedServerId}`, {
        server_id: selectedServerId,
        config
      });

      // 刷新服务器列表
      const serversResult = await httpClient.get('/api/mcp/servers');
      dispatch(setAllServersData(serversResult));
    } catch (error) {
      console.error('更新服务器配置失败:', error);
    }
  };

  // 处理类型选择
  const handleTransportSelect = async (transport: string) => {
    setShowTransportDropdown(false);
    await updateServerConfig({ transport });
  };

  // 获取当前选中的服务器
  const selectedServer = selectedServerId ? serversData[selectedServerId] : null;

  // 保存环境变量/请求头
  const handleSaveEnv = async (envString: string) => {
    const newEnv = parseEnvString(envString);
    await updateServerConfig({ env: newEnv });
  };

  return (
    <Panel defaultSize={85} minSize={0} maxSize={100} className="p-4 h-full overflow-y-auto">
      {!selectedServer ? (
        <div className="flex items-center justify-center h-full text-theme-gray4">
          <p>请选择一个MCP服务器查看详情</p>
        </div>
      ) : (
        <>
          {/* 服务器详情 */}
          <div key={selectedServerId} className="mb-5 p-3 border border-theme-gray3 rounded">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-white text-base font-medium">服务器详情</h3>
              <div className="flex items-center">
                <span className="text-theme-white mr-2.5 text-sm">启用服务器</span>
                <button
                  onClick={handleToggleServer}
                  className={`w-12 h-6 rounded-full transition-colors ${selectedServer?.isActive ? 'bg-theme-green' : 'bg-theme-gray3'}`}
                >
                  <div
                    className={`w-5 h-5 bg-white rounded-full transition-transform ${selectedServer?.isActive ? 'translate-x-6' : 'translate-x-0.5'}`}
                  />
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <div>
                <span className="text-theme-gray4 text-sm">名称:</span>
                <input
                  type="text"
                  defaultValue={selectedServer.name}
                  onBlur={(e) => updateServerConfig({ name: e.target.value })}
                  className="ml-2 bg-theme-gray2 text-white px-2 py-1 rounded border border-theme-gray3 focus:border-theme-green outline-none"
                />
              </div>
              <div>
                <span className="text-theme-gray4 text-sm">描述:</span>
                <input
                  type="text"
                  defaultValue={selectedServer.description || ''}
                  onBlur={(e) => updateServerConfig({ description: e.target.value })}
                  className="ml-2 bg-theme-gray2 text-white px-2 py-1 rounded border border-theme-gray3 focus:border-theme-green outline-none"
                />
              </div>
              <div>
                <span className="text-theme-gray4 text-sm">类型:</span>
                <div className="inline-block relative ml-2">
                  <button
                    onClick={() => setShowTransportDropdown(!showTransportDropdown)}
                    className="bg-theme-gray2 text-white px-3 py-1 rounded border border-theme-gray3 focus:border-theme-green outline-none flex items-center"
                  >
                    {selectedServer.transport}
                    <FontAwesomeIcon icon={faChevronDown} className="ml-2 text-xs" />
                  </button>
                  {showTransportDropdown && (
                    <div className="absolute top-full left-0 mt-1 bg-theme-gray1 border border-theme-gray3 rounded shadow-lg z-10">
                      {['stdio', 'sse', 'http'].map((transport) => (
                        <button
                          key={transport}
                          onClick={() => handleTransportSelect(transport)}
                          className="block w-full text-left px-3 py-1 text-white hover:bg-theme-gray2"
                        >
                          {transport}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              {selectedServer.transport === 'stdio' && (
                <>
                  <div>
                    <span className="text-theme-gray4 text-sm">命令:</span>
                    <input
                      type="text"
                      defaultValue={selectedServer.command || ''}
                      onBlur={(e) => updateServerConfig({ command: e.target.value })}
                      className="ml-2 bg-theme-gray2 text-white px-2 py-1 rounded border border-theme-gray3 focus:border-theme-green outline-none"
                    />
                  </div>
                  <div>
                    <span className="text-theme-gray4 text-sm">参数:</span>
                    <input
                      type="text"
                      defaultValue={selectedServer.args?.join(' ') || ''}
                      onBlur={(e) => updateServerConfig({ args: e.target.value.split(' ').filter(a => a) })}
                      className="ml-2 bg-theme-gray2 text-white px-2 py-1 rounded border border-theme-gray3 focus:border-theme-green outline-none"
                    />
                  </div>
                </>
              )}
              {(selectedServer.transport === 'http' || selectedServer.transport === 'sse') && (
                <div>
                  <span className="text-theme-gray4 text-sm">Base URL:</span>
                  <input
                    type="text"
                    defaultValue={selectedServer.baseUrl || ''}
                    onBlur={(e) => updateServerConfig({ baseUrl: e.target.value })}
                    className="ml-2 bg-theme-gray2 text-white px-2 py-1 rounded border border-theme-gray3 focus:border-theme-green outline-none"
                  />
                </div>
              )}
              <div>
                <span className="text-theme-gray4 text-sm">
                  {selectedServer.transport === 'stdio' ? '环境变量:' : '请求头:'}
                </span>
                <input
                  type="text"
                  defaultValue={envToString(selectedServer.env)}
                  onBlur={(e) => handleSaveEnv(e.target.value)}
                  className="ml-2 bg-theme-gray2 text-white px-2 py-1 rounded border border-theme-gray3 focus:border-theme-green outline-none"
                  placeholder="KEY1=value1 KEY2=value2"
                />
              </div>
            </div>
          </div>

          {/* 工具列表 */}
          <div>
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-white text-base font-medium">MCP工具列表</h3>
              <button
                onClick={loadMCPTools}
                disabled={isLoading}
                className={`p-2 rounded transition-colors ${
                  isLoading
                    ? 'bg-theme-gray3 text-theme-gray5 cursor-not-allowed'
                    : 'bg-theme-green text-black hover:bg-theme-green1'
                }`}
              >
                {isLoading ? (
                  <FontAwesomeIcon icon={faRotate} spin />
                ) : (
                  <FontAwesomeIcon icon={faRotate} />
                )}
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
