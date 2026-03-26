import { useState } from 'react';
import { Panel } from 'react-resizable-panels';
import { useSelector, useDispatch } from 'react-redux';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faRotate, faChevronDown, faPlus, faTrash } from '@fortawesome/free-solid-svg-icons';
import type { RootState, ServerDetailPanelProps, McpTabType } from '@/types';
import {
  setServerLoading,
  setAllServersConfig,
  setServerTools,
} from '../../store/mcp';
import httpClient from '../../utils/httpClient';
import NotificationModal from './modals/NotificationModal';

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

const ServerDetailPanel = ({}: ServerDetailPanelProps) => {
  const dispatch = useDispatch();

  // 从 Redux 获取数据
  const selectedServerId = useSelector((state: RootState) => state.mcpSlice.mcpData.selectedId);
  const serversData = useSelector((state: RootState) => state.mcpSlice.mcpData.config);
  const toolsData = useSelector((state: RootState) => state.mcpSlice.mcpData.tools);
  const isLoading = useSelector((state: RootState) => state.mcpSlice.loadingServers.length > 0);
  
  // 获取当前选中服务器及其工具列表
  const selectedServer = selectedServerId ? serversData[selectedServerId] : null;
  const tools = selectedServerId ? (toolsData[selectedServerId] || []) : [];

  // 标签页状态
  const [activeTab, setActiveTab] = useState<McpTabType>('params');

  // 编辑状态
  const [showTransportDropdown, setShowTransportDropdown] = useState(false);
  const [showCommandDropdown, setShowCommandDropdown] = useState(false);

  // 环境变量添加状态
  const [newEnvKey, setNewEnvKey] = useState('');
  const [newEnvValue, setNewEnvValue] = useState('');

  // 通知弹窗状态
  const [showNotification, setShowNotification] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState('');

  // 加载MCP工具列表（刷新按钮使用）
  const loadMCPTools = async () => {
    if (!selectedServerId) return;

    try {
      dispatch(setServerLoading({ serverId: selectedServerId, loading: true }));
      
      // 调用后端 API 获取该服务器的工具列表
      const result = await httpClient.get(`/api/mcp/servers/${selectedServerId}/tools`);
      if (result) {
        // 使用 setServerTools
        dispatch(setServerTools({
          serverId: selectedServerId,
          tools: result.tools || [],
          error: result.error || null
        }));
      }
    } catch (error) {
      setNotificationMessage(`加载MCP工具失败: ${(error as Error).message}`);
      setShowNotification(true);
      // 更新错误状态到 store
      dispatch(setServerTools({
        serverId: selectedServerId,
        tools: [],
        error: (error as Error).message
      }));
    } finally {
      dispatch(setServerLoading({ serverId: selectedServerId, loading: false }));
    }
  };

  // 切换服务器启用/禁用状态
  const handleToggleServer = async () => {
    if (!selectedServerId) return;

    const newActiveState = !selectedServer?.isActive;

    try {
      // 获取当前服务器配置
      const currentConfig = serversData[selectedServerId];
      if (!currentConfig) return;

      // 更新服务器状态
      const serversResult = await httpClient.post('/api/mcp/servers', {
        server_id: selectedServerId,
        config: {
          ...currentConfig,
          isActive: newActiveState
        }
      });

      dispatch(setAllServersConfig(serversResult));
    } catch (error) {
      setNotificationMessage(`更新服务器状态失败: ${(error as Error).message}`);
      setShowNotification(true);
    }
  };

  // 更新服务器配置
  const updateServerConfig = async (config: Record<string, any>) => {
    if (!selectedServerId) return;

    try {
      // 获取当前服务器配置并合并更新
      const currentConfig = serversData[selectedServerId];
      if (!currentConfig) return;
      const serversResult = await httpClient.post('/api/mcp/servers', {
        server_id: selectedServerId,
        config: {
          ...currentConfig,
          ...config
        }
      });

      dispatch(setAllServersConfig(serversResult));
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

  // 保存请求头
  const handleSaveHeaders = async (headersString: string) => {
    const newHeaders = parseHeadersString(headersString);
    await updateServerConfig({ headers: newHeaders });
  };

  // 添加环境变量
  const handleAddEnv = async () => {
    if (!selectedServerId || !newEnvKey.trim()) return;

    const key = newEnvKey.trim();
    const value = newEnvValue.trim();

    try {
      const currentEnv = selectedServer?.env || [];
      const newEnvList = currentEnv.includes(key) ? currentEnv : [...currentEnv, key];
      
      await updateServerConfig({
        env: newEnvList,
        envValues: {
          ...(selectedServer?.envValues || {}),
          [key]: value
        }
      });

      // 清空输入框
      setNewEnvKey('');
      setNewEnvValue('');
    } catch (error) {
      setNotificationMessage(`添加环境变量失败: ${(error as Error).message}`);
      setShowNotification(true);
    }
  };

  // 删除环境变量
  const handleDeleteEnv = async (key: string) => {
    if (!selectedServerId) return;

    try {
      // 更新 env 列表（移除 key）
      const currentEnv = selectedServer?.env || [];
      const newEnvList = currentEnv.filter((k: string) => k !== key);
      await updateServerConfig({ env: newEnvList });
    } catch (error) {
      setNotificationMessage(`删除环境变量失败: ${(error as Error).message}`);
      setShowNotification(true);
    }
  };

  // 更新环境变量值
  const handleUpdateEnvValue = async (key: string, value: string) => {
    if (!selectedServerId) return;

    try {
      await updateServerConfig({
        envValues: {
          ...(selectedServer?.envValues || {}),
          [key]: value
        }
      });
    } catch (error) {
      setNotificationMessage(`更新环境变量失败: ${(error as Error).message}`);
      setShowNotification(true);
    }
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

                    {/* 环境变量配置 */}
                    <div className="space-y-3">
                      <label className="block text-theme-gray4 text-sm">环境变量</label>
                      
                      {/* 已添加的环境变量列表 */}
                      <div className="space-y-2">
                        {(selectedServer.env || []).map((key: string) => (
                          <div key={key} className="flex items-center gap-2">
                            <div className="flex-1 bg-theme-gray2 px-3 py-2 rounded border border-theme-gray3">
                              <span className="text-white text-sm">{key}</span>
                            </div>
                            <input
                              type="text"
                              value={selectedServer.envValues?.[key] || ''}
                              onChange={(e) => {
                                // 本地状态更新，不立即保存
                                if (!selectedServerId || !selectedServer) return;
                                const newEnvValues = { ...(selectedServer.envValues || {}), [key]: e.target.value };
                                // 直接更新本地状态，不触发API调用
                                const updatedServer = { ...selectedServer, envValues: newEnvValues };
                                dispatch(setAllServersConfig({
                                  ...serversData,
                                  [selectedServerId]: updatedServer
                                }));
                              }}
                              onBlur={(e) => handleUpdateEnvValue(key, e.target.value)}
                              placeholder="值"
                              className="flex-[2] bg-theme-gray2 text-white px-3 py-2 rounded border border-theme-gray3 focus:border-theme-green outline-none text-sm"
                            />
                            <button
                              onClick={() => handleDeleteEnv(key)}
                              className="p-2 text-theme-gray4 hover:text-red-400 transition-colors"
                              title="删除"
                            >
                              <FontAwesomeIcon icon={faTrash} />
                            </button>
                          </div>
                        ))}
                      </div>

                      {/* 添加新环境变量 */}
                      <div className="flex items-center gap-2 pt-2 border-t border-theme-gray3">
                        <input
                          type="text"
                          value={newEnvKey}
                          onChange={(e) => setNewEnvKey(e.target.value)}
                          placeholder="变量名"
                          className="flex-1 bg-theme-gray2 text-white px-3 py-2 rounded border border-theme-gray3 focus:border-theme-green outline-none text-sm"
                        />
                        <input
                          type="text"
                          value={newEnvValue}
                          onChange={(e) => setNewEnvValue(e.target.value)}
                          placeholder="值"
                          className="flex-[2] bg-theme-gray2 text-white px-3 py-2 rounded border border-theme-gray3 focus:border-theme-green outline-none text-sm"
                        />
                        <button
                          onClick={handleAddEnv}
                          disabled={!newEnvKey.trim()}
                          className="p-2 bg-theme-green text-white rounded hover:bg-opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          title="添加"
                        >
                          <FontAwesomeIcon icon={faPlus} />
                        </button>
                      </div>
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
                {tools.length === 0 ? (
                  <p className="text-theme-gray4">暂无MCP工具</p>
                ) : (
                  <ul className="list-none p-0 m-0 space-y-2">
                    {tools.map((tool) => (
                      <li
                        key={tool.name}
                        className="p-2 border border-theme-gray3 rounded hover:bg-theme-gray2 transition-colors"
                      >
                        <strong className="text-white block">{tool.name}</strong>
                        <div className="text-xs text-theme-gray4 mt-1">
                          {tool.description || '无描述'}
                        </div>
                      </li>
                    ))}
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
