import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { setAllServersConfig, setServerLoading, setSelectedServerId, setServerTools } from '../../store/mcp';
import ServerListPanel from './ServerListPanel';
import ServerDetailPanel from './ServerDetailPanel';
import httpClient from '../../utils/httpClient';
import NotificationModal from './modals/NotificationModal';

const MCPSettingsPanel = () => {
  const dispatch = useDispatch();
  const [showNotification, setShowNotification] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState('');

  // 挂载时从后端获取MCP服务器数据和工具列表
  useEffect(() => {
    const initialize = async () => {
      try {
        // 获取所有服务器配置
        const serversResult = await httpClient.get('/api/mcp/servers');
        if (serversResult) {
          dispatch(setAllServersConfig(serversResult));
          
          // 将所有活跃的服务器添加到加载列表
          const activeServerIds = Object.entries(serversResult)
            .filter(([_, config]) => (config as any).isActive)
            .map(([serverId]) => serverId);
          
          for (const serverId of activeServerIds) {
            dispatch(setServerLoading({ serverId, loading: true }));
          }
          
          // 循环获取每个活跃服务器的工具列表
          const failedServers: string[] = [];
          for (const serverId of activeServerIds) {
            try {
              // 调用新API获取单个服务器的工具列表
              const toolsResult = await httpClient.get(`/api/mcp/servers/${serverId}/tools`);
              dispatch(setServerTools({
                serverId,
                tools: toolsResult.tools || [],
                error: null
              }));
            } catch (error: any) {
              const errorMsg = error?.message || String(error);
              failedServers.push(`获取 ${serverId} 的工具失败: ${errorMsg}`);
              dispatch(setServerTools({
                serverId,
                tools: [],
                error: errorMsg
              }));
              
              // 尝试禁用失败的服务器
              try {
                const currentConfig = serversResult[serverId];
                await httpClient.post('/api/mcp/servers', {
                  server_id: serverId,
                  config: { ...currentConfig, isActive: false }
                });
              } catch (updateError) {
                console.error(`更新服务器 ${serverId} 状态失败:`, updateError);
              }
            } finally {
              dispatch(setServerLoading({ serverId, loading: false }));
            }
          }
          
          // 如果有失败的服务器，显示通知
          if (failedServers.length > 0) {
            setNotificationMessage(failedServers.join('\n'));
            setShowNotification(true);
          }
          
          // 重新获取服务器列表以更新状态（禁用操作后的状态同步）
          const updatedServersResult = await httpClient.get('/api/mcp/servers');
          dispatch(setAllServersConfig(updatedServersResult));
        }
      } catch (error) {
        console.error('加载MCP服务器失败:', error);
      }
    };
    
    initialize();
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
      
      {/* 通知弹窗 */}
      {showNotification && (
        <NotificationModal
          message={notificationMessage}
          onClose={() => setShowNotification(false)}
        />
      )}
    </div>
  );
};

export default MCPSettingsPanel;
