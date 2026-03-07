import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { setAllServersData, setSingleServerTools, setAllServersData as updateAllServersData, addLoadingServer, removeLoadingServer } from '../../store/mcp';
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
          dispatch(setAllServersData(serversResult));
          
          // 将所有活跃的服务器添加到加载列表
          const activeServerIds = Object.entries(serversResult)
            .filter(([_, config]) => (config as any).isActive)
            .map(([serverId]) => serverId);
          
          for (const serverId of activeServerIds) {
            dispatch(addLoadingServer(serverId));
          }
          
          // 获取所有活跃服务器的工具列表
          const toolsResult = await httpClient.get('/api/mcp/tools/all');
          
          // 处理每个服务器的工具和错误
          const failedServers: string[] = [];
          for (const [serverId, serverData] of Object.entries(toolsResult)) {
            const data = serverData as { tools: any; error: string | null; server_name?: string };
            dispatch(setSingleServerTools({ serverId, tools: data.tools }));
            dispatch(removeLoadingServer(serverId));
            
            // 如果有错误，记录失败的服务器
            if (data.error) {
              failedServers.push(`获取 ${data.server_name || serverId} 的工具失败: ${data.error}`);
              // 将服务器状态设置为 false
              try {
                await httpClient.put(`/api/mcp/servers/${serverId}`, {
                  server_id: serverId,
                  config: { isActive: false }
                });
              } catch (updateError) {
                console.error(`更新服务器 ${serverId} 状态失败:`, updateError);
              }
            }
          }
          
          // 如果有失败的服务器，显示通知
          if (failedServers.length > 0) {
            setNotificationMessage(failedServers.join('\n'));
            setShowNotification(true);
          }
          
          // 重新获取服务器列表以更新状态
          const updatedServersResult = await httpClient.get('/api/mcp/servers');
          dispatch(updateAllServersData(updatedServersResult));
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
