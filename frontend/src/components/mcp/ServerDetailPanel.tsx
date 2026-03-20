import { useState } from 'react';
import { Panel } from 'react-resizable-panels';
import { useSelector, useDispatch } from 'react-redux';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faRotate, faChevronDown } from '@fortawesome/free-solid-svg-icons';
import type { RootState } from '../../store/store';
import {
  setSingleServerTools,
  setLoading,
  setAllServersData,
  addLoadingServer,
  removeLoadingServer,
} from '../../store/mcp';
import httpClient from '../../utils/httpClient';
import NotificationModal from './modals/NotificationModal';

type TabType = 'params' | 'tools';

// 解析环境变量字符串为对象（支持换行）
const parseEnvString = (str: string): Record<string, string> => {
  const result: Record<string, string> = {};
  // 只按换行符分割，因为环境变量的值可能包含空格
  const pairs = str.trim().split('\n');
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
    .join('\n');
};

// 解析请求头字符串为对象（支持换行）
const parseHeadersString = (str: string): Record<string, string> => {
  const result: Record<string, string> = {};
  // 只按换行符分割，因为请求头的值可能包含空格
  const pairs = str.trim().split('\n');
  for (const pair of pairs) {
    const [key, ...valueParts] = pair.split('=');
    if (key) {
      result[key] = valueParts.join('=') || '';
    }
  }
  return result;
};

// 将对象转换为请求头字符串
const headersToString = (headers: Record<string, string> | undefined): string => {
  if (!headers) return '';
  return Object.entries(headers)
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');
};

interface ServerDetailPanelProps {}

const ServerDetailPanel = ({}: ServerDetailPanelProps) => {
  const dispatch = useDispatch();

  // 从 Redux 获取数据
  const selectedServerId = useSelector((state: RootState) => state.mcpSlice.selectedServerId);
  const serversData = useSelector((state: RootState) => state.mcpSlice.allServersData);
  const serverTools = useSelector((state: RootState) => state.mcpSlice.serverTools);
  const isLoading = useSelector((state: RootState) => state.mcpSlice.isLoading);
  
  // 获取当前选中服务器的工具列表
  const tools = selectedServerId ? (serverTools[selectedServerId] || {}) : {};

  // 标签页状态
  const [activeTab, setActiveTab] = useState<TabType>('params');

  // 编辑状态
  const [showTransportDropdown, setShowTransportDropdown] = useState(false);
  const [showCommandDropdown, setShowCommandDropdown] = useState(false);

  // 通知弹窗状态
  const [showNotification, setShowNotification] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState('');
  // 获取当前选中的服务器
  const selectedServer = selectedServerId ? serversData[selectedServerId] : null;

  // 加载MCP工具列表（刷新按钮使用）
  const loadMCPTools = async () => {
    if (!selectedServerId) return;

    try {
      dispatch(setLoading(true));
      dispatch(addLoadingServer(selectedServerId));
      
      // 调用后端子进程的 API 获取 MCP 工具
      const result = await httpClient.get(`/api/mcp/tools?server_id=${selectedServerId}`);
      dispatch(setSingleServerTools({ serverId: selectedServerId, tools: result }));
    } catch (error) {
      setNotificationMessage(`加载MCP工具失败: ${(error as Error).message}`);
      setShowNotification(true);
      // 获取失败时，将服务器状态设置为 false
      try {
        await httpClient.put(`/api/mcp/servers/${selectedServerId}`, {
          server_id: selectedServerId,
          config: { isActive: false }
        });
        // 刷新服务器列表
        const serversResult = await httpClient.get('/api/mcp/servers');
        dispatch(setAllServersData(serversResult));
      } catch (updateError) {
        console.error(`更新服务器 ${selectedServerId} 状态失败:`, updateError);
      }
    } finally {
      dispatch(setLoading(false));
      dispatch(removeLoadingServer(selectedServerId));
    }
  };

  // 切换服务器启用/禁用状态
  const handleToggleServer = async () => {
    if (!selectedServerId) return;

    const newActiveState = !selectedServer?.isActive;

    try {
      // 更新服务器状态
      await httpClient.put(`/api/mcp/servers/${selectedServerId}`, {
        server_id: selectedServerId,
        config: {
          isActive: newActiveState
        }
      });

      // 刷新服务器列表
      const serversResult = await httpClient.get('/api/mcp/servers');
      dispatch(setAllServersData(serversResult));

      // 如果是启用状态，获取工具
      if (newActiveState) {
        await loadMCPTools();
      }
    } catch (error) {
      setNotificationMessage(`更新服务器状态失败: ${(error as Error).message}`);
      setShowNotification(true);
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
      setNotificationMessage(`更新服务器配置失败: ${(error as Error).message}`);
      setShowNotification(true);
    }
  };

  // 处理类型选择
  const handleTransportSelect = async (transport: string) => {
    setShowTransportDropdown(false);
    await updateServerConfig({ transport });
  };

  // 处理命令选择
  const handleCommandSelect = (command: string) => {
    updateServerConfig({ command });
    setShowCommandDropdown(false);
  };

  // 保存环境变量
  const handleSaveEnv = async (envString: string) => {
    const newEnv = parseEnvString(envString);
    await updateServerConfig({ env: newEnv });
  };

  // 保存请求头
  const handleSaveHeaders = async (headersString: string) => {
    const newHeaders = parseHeadersString(headersString);
    await updateServerConfig({ headers: newHeaders });
  };

  return (
    <Panel defaultSize={85} minSize={0} maxSize={100} className="p-4 h-full flex flex-col">
      {!selectedServer ? (
        <div className="flex items-center justify-center h-full text-theme-gray4">
          <p>请选择一个MCP服务器查看详情</p>
        </div>
      ) : (
        <>
          {/* 标签栏 */}
          <div className="flex border-b border-theme-gray3 mb-4">
            <button
              onClick={() => setActiveTab('params')}
              className={`flex-1 px-4 py-2 text-sm ${
                activeTab === 'params'
                  ? 'bg-theme-gray2 text-theme-green border-b-2 border-theme-green'
                  : 'text-theme-white hover:bg-theme-gray2'
              }`}
            >
              参数
            </button>
            <button
              onClick={() => setActiveTab('tools')}
              className={`flex-1 px-4 py-2 text-sm ${
                activeTab === 'tools'
                  ? 'bg-theme-gray2 text-theme-green border-b-2 border-theme-green'
                  : 'text-theme-white hover:bg-theme-gray2'
              }`}
            >
              工具
            </button>
          </div>

          {/* 内容区域 */}
          <div className="flex-1 overflow-y-auto">
            {activeTab === 'params' && (
              <div key={selectedServerId} className="space-y-6">
                {/* 服务器基本信息 */}
                <div className="flex justify-between items-center">
                  <h3 className="text-white text-lg font-medium">服务器配置</h3>
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

                {/* 基本信息区块 */}
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="block text-theme-gray4 text-sm">名称</label>
                    <input
                      type="text"
                      defaultValue={selectedServer.name}
                      onBlur={(e) => updateServerConfig({ name: e.target.value })}
                      className="w-full bg-theme-gray2 text-white px-3 py-2 rounded border border-theme-gray3 focus:border-theme-green outline-none"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="block text-theme-gray4 text-sm">描述</label>
                    <input
                      type="text"
                      defaultValue={selectedServer.description || ''}
                      onBlur={(e) => updateServerConfig({ description: e.target.value })}
                      className="w-full bg-theme-gray2 text-white px-3 py-2 rounded border border-theme-gray3 focus:border-theme-green outline-none"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="block text-theme-gray4 text-sm">类型</label>
                    <div className="relative w-full">
                      <button
                        onClick={() => setShowTransportDropdown(!showTransportDropdown)}
                        className="w-full bg-theme-gray2 text-white px-3 py-2 rounded border border-theme-gray3 focus:border-theme-green outline-none flex items-center justify-between"
                      >
                        <span>{selectedServer.transport}</span>
                        <FontAwesomeIcon icon={faChevronDown} className="text-xs" />
                      </button>
                      {showTransportDropdown && (
                        <div className="absolute top-full left-0 right-0 mt-1 bg-theme-gray1 border border-theme-gray3 rounded shadow-lg z-10">
                          {['stdio', 'sse', 'http'].map((transport) => (
                            <button
                              key={transport}
                              onClick={() => handleTransportSelect(transport)}
                              className="block w-full text-left px-3 py-2 text-white hover:bg-theme-gray2"
                            >
                              {transport}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* stdio 配置区块 */}
                {selectedServer.transport === 'stdio' && (
                  <div className="space-y-4 pt-4 border-t border-theme-gray3">
                    <h4 className="text-white text-base font-medium">Stdio 配置</h4>
                    <div className="space-y-2">
                      <label className="block text-theme-gray4 text-sm">命令</label>
                      <div className="relative w-full">
                        <button
                          onClick={() => setShowCommandDropdown(!showCommandDropdown)}
                          className="w-full bg-theme-gray2 text-white px-3 py-2 rounded border border-theme-gray3 focus:border-theme-green outline-none flex items-center justify-between"
                        >
                          <span>{selectedServer.command || '选择命令'}</span>
                          <FontAwesomeIcon icon={faChevronDown} className="text-xs" />
                        </button>
                        {showCommandDropdown && (
                          <div className="absolute top-full left-0 right-0 mt-1 bg-theme-gray1 border border-theme-gray3 rounded shadow-lg z-10">
                            {['uvx', 'npx'].map((command) => (
                              <button
                                key={command}
                                onClick={() => handleCommandSelect(command)}
                                className="block w-full text-left px-3 py-2 text-white hover:bg-theme-gray2"
                              >
                                {command}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="block text-theme-gray4 text-sm">参数</label>
                      <textarea
                        defaultValue={selectedServer.args?.join('\n') || ''}
                        onBlur={(e) => updateServerConfig({ args: e.target.value.split('\n').map(arg => arg.trim()).filter(a => a) })}
                        className="w-full bg-theme-gray2 text-white px-3 py-2 rounded border border-theme-gray3 focus:border-theme-green outline-none min-h-[120px] resize-y"
                        rows={4}
                        placeholder="每行一个参数"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="block text-theme-gray4 text-sm">环境变量</label>
                      <textarea
                        defaultValue={envToString(selectedServer.env)}
                        onBlur={(e) => handleSaveEnv(e.target.value)}
                        className="w-full bg-theme-gray2 text-white px-3 py-2 rounded border border-theme-gray3 focus:border-theme-green outline-none min-h-[120px] resize-y"
                        rows={4}
                        placeholder="KEY1=value1&#10;KEY2=value2&#10;请不要输入多余的空格"
                      />
                    </div>
                  </div>
                )}

                {/* HTTP/SSE 配置区块 */}
                {(selectedServer.transport === 'http' || selectedServer.transport === 'sse') && (
                  <div className="space-y-4 pt-4 border-t border-theme-gray3">
                    <h4 className="text-white text-base font-medium">{selectedServer.transport === 'http' ? 'HTTP' : 'SSE'} 配置</h4>
                    <div className="space-y-2">
                      <label className="block text-theme-gray4 text-sm">URL</label>
                      <input
                        type="text"
                        defaultValue={selectedServer.url || ''}
                        onBlur={(e) => updateServerConfig({ url: e.target.value })}
                        className="w-full bg-theme-gray2 text-white px-3 py-2 rounded border border-theme-gray3 focus:border-theme-green outline-none"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="block text-theme-gray4 text-sm">请求头</label>
                      <textarea
                        defaultValue={headersToString(selectedServer.headers)}
                        onBlur={(e) => handleSaveHeaders(e.target.value)}
                        className="w-full bg-theme-gray2 text-white px-3 py-2 rounded border border-theme-gray3 focus:border-theme-green outline-none min-h-[120px] resize-y"
                        rows={4}
                        placeholder="Authorization=Bearer YOUR_TOKEN&#10;X-Custom-Header=custom-value"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'tools' && (
              <div className="h-full flex flex-col">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="text-white text-base font-medium">MCP工具列表</h3>
                  <button
                    onClick={loadMCPTools}
                    disabled={isLoading}
                    className={`p-2 transition-colors ${
                      isLoading
                        ? 'text-theme-gray5 cursor-not-allowed'
                        : 'text-white hover:text-theme-green'
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
                    {Object.entries(tools).map(([name, tool]) => {
                      const toolData = tool as { name: string; description: string; inputSchema?: any };
                      return (
                        <li
                          key={name}
                          className="p-2 border border-theme-gray3 rounded hover:bg-theme-gray2 transition-colors"
                        >
                          <strong className="text-white block">{name}</strong>
                          <div className="text-xs text-theme-gray4 mt-1">
                            {toolData.description || '无描述'}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            )}
          </div>
        </>
      )}

      {/* 通知弹窗 */}
      {showNotification && (
        <NotificationModal
          message={notificationMessage}
          onClose={() => setShowNotification(false)}
        />
      )}
    </Panel>
  );
};

export default ServerDetailPanel;
