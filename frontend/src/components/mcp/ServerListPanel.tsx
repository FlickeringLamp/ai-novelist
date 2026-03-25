import { useState } from 'react';
import { Panel } from 'react-resizable-panels';
import { useSelector, useDispatch } from 'react-redux';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner } from '@fortawesome/free-solid-svg-icons';
import type { RootState } from '../../store/store';
import {
  setAllServersConfig,
  setSelectedServerId,
  setServerTools,
} from '../../store/mcp';
import ServerContextMenu from './modals/ServerContextMenu';
import DeleteConfirmModal from './modals/DeleteConfirmModal';
import NotificationModal from './modals/NotificationModal';
import httpClient from '../../utils/httpClient';

interface ServerListPanelProps {}

const ServerListPanel = ({}: ServerListPanelProps) => {
  const dispatch = useDispatch();

  // 从 Redux 获取数据
  const serversData = useSelector((state: RootState) => state.mcpSlice.mcpData.config);
  const selectedServerId = useSelector((state: RootState) => state.mcpSlice.mcpData.selectedId);
  const loadingServers = useSelector((state: RootState) => state.mcpSlice.loadingServers);

  // 删除确认模态框相关状态
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
  const [serverToDelete, setServerToDelete] = useState('');

  // 通知弹窗状态
  const [showNotification, setShowNotification] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState('');

  // 右键菜单相关状态
  const [contextMenu, setContextMenu] = useState<{
    visible: boolean;
    x: number;
    y: number;
    serverId: string | null;
  }>({ visible: false, x: 0, y: 0, serverId: null });

  // 处理右键菜单
  const handleContextMenu = (e: React.MouseEvent, serverId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      serverId
    });
  };

  // 关闭右键菜单
  const closeContextMenu = () => {
    setContextMenu({ ...contextMenu, visible: false, serverId: null });
  };

  // 处理删除服务器
  const handleDeleteServer = (serverId: string) => {
    setServerToDelete(serverId);
    setShowDeleteConfirmModal(true);
    closeContextMenu();
  };

  // 确认删除服务器
  const confirmDeleteServer = async (serverId: string) => {
    try {
      const serverName = serversData[serverId]?.name || serverId;
      await httpClient.delete(`/api/mcp/servers/${serverId}`);
      
      // 刷新服务器列表
      const result = await httpClient.get('/api/mcp/servers');
      dispatch(setAllServersConfig(result));
      
      if (selectedServerId === serverId) {
        dispatch(setSelectedServerId(null));
      }
      
      setShowDeleteConfirmModal(false);
      setServerToDelete('');
    } catch (error) {
      setNotificationMessage(`删除失败: ${(error as Error).message}`);
      setShowNotification(true);
      setShowDeleteConfirmModal(false);
      setServerToDelete('');
    }
  };

  // 处理添加服务器
  const handleAddServer = async () => {
    try {
      // 使用时间戳作为服务器ID
      const serverId = Date.now().toString();
      
      // 创建默认配置
      const defaultConfig = {
        name: "添加mcp服务器",
        description: "",
        url: "",
        isActive: false,
        transport: "stdio",
        command: "uvx",
        args: [],
        env: []
      };
      
      // 调用后端API添加配置
      await httpClient.post('/api/mcp/servers', { server_id: serverId, config: defaultConfig });

      // 刷新服务器列表
      const result = await httpClient.get('/api/mcp/servers');
      dispatch(setAllServersConfig(result));
      
      // 选中新添加的服务器
      dispatch(setSelectedServerId(serverId));
      dispatch(setServerTools({ serverId, tools: [] }));
    } catch (error) {
      setNotificationMessage(`添加失败: ${(error as Error).message}`);
      setShowNotification(true);
    }
  };

  return (
    <>
      <Panel defaultSize={15} minSize={0} maxSize={100} className="h-full flex flex-col">
        {/* 添加服务器按钮 */}
        <div className="p-1 border-b border-theme-gray3">
          <button
            onClick={handleAddServer}
            className="w-full px-4 py-2 rounded hover:bg-theme-gray2 hover:text-theme-green"
          >
            添加服务器
          </button>
        </div>
        
        {/* 服务器列表 */}
        <div className="flex-1 overflow-y-auto">
          {Object.keys(serversData).map((serverId, index) => (
            <div
              key={index}
              className={`p-2 m-1 cursor-pointer border border-theme-gray3 hover:bg-theme-gray2 hover:text-theme-green ${
                selectedServerId === serverId ? 'bg-theme-gray2 text-theme-green' : ''
              }`}
              onClick={() => {
                dispatch(setSelectedServerId(serverId));
              }}
              onContextMenu={(e) => handleContextMenu(e, serverId)}
            >
              <div className="flex justify-between items-center">
                <span className="flex-1">{serversData[serverId]?.name || serverId}</span>
                <span className={`ml-2 ${serversData[serverId]?.isActive ? 'text-theme-green' : 'text-theme-gray4'}`}>
                  {loadingServers.includes(serverId) ? (
                    <FontAwesomeIcon icon={faSpinner} spin />
                  ) : serversData[serverId]?.isActive ? (
                    '✓'
                  ) : (
                    '✗'
                  )}
                </span>
              </div>
            </div>
          ))}
        </div>
      </Panel>

      {/* 删除确认模态框 */}
      <DeleteConfirmModal
        isOpen={showDeleteConfirmModal}
        serverId={serverToDelete}
        serverName={serversData[serverToDelete]?.name || serverToDelete}
        onClose={() => setShowDeleteConfirmModal(false)}
        onConfirm={confirmDeleteServer}
      />

      {/* 右键菜单 */}
      <ServerContextMenu
        visible={contextMenu.visible}
        x={contextMenu.x}
        y={contextMenu.y}
        serverId={contextMenu.serverId}
        serversData={serversData}
        onDelete={handleDeleteServer}
        onClose={closeContextMenu}
      />

      {/* 通知弹窗 */}
      {showNotification && (
        <NotificationModal
          message={notificationMessage}
          onClose={() => setShowNotification(false)}
        />
      )}
    </>
  );
};

export default ServerListPanel;
