import { useState, useEffect } from 'react';
import { Panel } from 'react-resizable-panels';
import { useSelector, useDispatch } from 'react-redux';
import type { RootState } from '../../store/store';
import {
  setAllProvidersData,
  setSelectedProviderId,
} from '../../store/provider';
import ProviderContextMenu from './modals/ProviderContextMenu';
import NotificationModal from './modals/NotificationModal';
import CustomProviderModal from './modals/CustomProviderModal';
import RenameProviderModal from './modals/RenameProviderModal';
import DeleteConfirmModal from './modals/DeleteConfirmModal';
import httpClient from '../../utils/httpClient';

interface ProviderListPanelProps {}

const ProviderListPanel = ({}: ProviderListPanelProps) => {
  const dispatch = useDispatch();

  // 从 Redux 获取数据
  const providersData = useSelector((state: RootState) => state.providerSlice.allProvidersData);
  const selectedProviderId = useSelector((state: RootState) => state.providerSlice.selectedProviderId);

  // 自定义提供商模态框状态
  const [showCustomProviderModal, setShowCustomProviderModal] = useState(false);

  // 通知弹窗状态
  const [showNotification, setShowNotification] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState('');

  // 右键菜单相关状态
  const [contextMenu, setContextMenu] = useState<{
    visible: boolean;
    x: number;
    y: number;
    providerId: string | null;
  }>({ visible: false, x: 0, y: 0, providerId: null });

  // 重命名相关状态
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [providerToRename, setProviderToRename] = useState('');

  // 删除确认模态框相关状态
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
  const [providerToDelete, setProviderToDelete] = useState('');

  // 处理右键菜单
  const handleContextMenu = (e: React.MouseEvent, providerId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      providerId
    });
  };

  // 关闭右键菜单
  const closeContextMenu = () => {
    setContextMenu({ ...contextMenu, visible: false, providerId: null });
  };

  // 处理删除提供商
  const handleDeleteProvider = (providerId: string) => {
    setProviderToDelete(providerId);
    setShowDeleteConfirmModal(true);
    closeContextMenu();
  };

  // 确认删除提供商
  const confirmDeleteProvider = async (providerId: string) => {
    try {
      const providerName = providersData[providerId]?.name || providerId;
      // 删除自定义提供商
      await httpClient.delete(`/api/provider/custom-providers/${providerId}`);

      // 刷新提供商列表
      const providersResult = await httpClient.get('/api/provider/providers');
      dispatch(setAllProvidersData(providersResult));
      setNotificationMessage(`提供商 "${providerName}" 删除成功`);
      setShowNotification(true);
    } catch (error) {
      setNotificationMessage(`删除失败: ${(error as Error).message}`);
      setShowNotification(true);
    } finally {
      dispatch(setSelectedProviderId(""))
      setShowDeleteConfirmModal(false);
      setProviderToDelete('');
    }
  };

  // 处理重命名提供商
  const handleRenameProvider = (providerId: string) => {
    setProviderToRename(providerId);
    setShowRenameModal(true);
    closeContextMenu();
  };

  // 处理自定义提供商提交
  const handleCustomProviderSubmit = async (name: string) => {
    try {
      await httpClient.post('/api/provider/custom-providers', {name: name});

      // 刷新提供商列表
      const providersResult = await httpClient.get('/api/provider/providers');
      dispatch(setAllProvidersData(providersResult));

      // 关闭模态框
      setShowCustomProviderModal(false);

      // 显示成功通知
      setNotificationMessage('自定义提供商添加成功');
      setShowNotification(true);
    } catch (error) {
      setNotificationMessage(`添加失败: ${(error as Error).message}`);
      setShowNotification(true);
    }
  };

  // 确认重命名提供商
  const confirmRenameProvider = async (providerId: string, newName: string) => {
    try {
      if (!newName.trim()) {
        setNotificationMessage('提供商名称不能为空');
        setShowNotification(true);
        return;
      }

      const currentName = providersData[providerId]?.name || providerId;
      if (newName === currentName) {
        setShowRenameModal(false);
        return;
      }

      // 更新提供商名称
      await httpClient.put(`/api/provider/custom-providers/${providerId}`, {
        name: newName
      });

      // 刷新提供商列表
      const providersResult = await httpClient.get('/api/provider/providers');
      dispatch(setAllProvidersData(providersResult));

      setNotificationMessage(`提供商重命名成功`);
      setShowNotification(true);
      setShowRenameModal(false);
    } catch (error) {
      setNotificationMessage(`重命名失败: ${(error as Error).message}`);
      setShowNotification(true);
    }
  };

  return (
    <Panel defaultSize={15} minSize={0} maxSize={100} className="h-full flex flex-col">
      {/* 自定义提供商按钮 */}
      <div className="p-1 border-b border-theme-gray3">
        <button
          onClick={() => setShowCustomProviderModal(true)}
          className="w-full px-4 py-2 rounded hover:bg-theme-gray2 hover:text-theme-green"
        >
          添加提供商
        </button>
      </div>
      <div className="flex-1 overflow-y-auto">
        {Object.keys(providersData).map((providerId, index) => (
          <div
            key={index}
            className={`p-2 m-1 cursor-pointer border-1 border-theme-gray3 hover:bg-theme-gray2 hover:text-theme-green ${
              selectedProviderId === providerId ? 'bg-theme-gray2 text-theme-green' : ''
            }`}
            onClick={() => dispatch(setSelectedProviderId(providerId))}
            onContextMenu={(e) => handleContextMenu(e, providerId)}
          >
            {providersData[providerId]?.name || providerId}
          </div>
        ))}
      </div>

      {/* 通知弹窗 */}
      {showNotification && (
        <NotificationModal
          message={notificationMessage}
          onClose={() => setShowNotification(false)}
        />
      )}

      {/* 自定义提供商模态框 */}
      <CustomProviderModal
        isOpen={showCustomProviderModal}
        onClose={() => setShowCustomProviderModal(false)}
        onSubmit={handleCustomProviderSubmit}
      />

      {/* 右键菜单 */}
      <ProviderContextMenu
        visible={contextMenu.visible}
        x={contextMenu.x}
        y={contextMenu.y}
        providerId={contextMenu.providerId}
        providersData={providersData}
        onRename={handleRenameProvider}
        onDelete={handleDeleteProvider}
        onClose={closeContextMenu}
      />

      {/* 重命名模态框 */}
      <RenameProviderModal
        isOpen={showRenameModal}
        providerId={providerToRename}
        currentName={providersData[providerToRename]?.name || providerToRename}
        onClose={() => setShowRenameModal(false)}
        onSubmit={confirmRenameProvider}
      />

      {/* 删除确认模态框 */}
      <DeleteConfirmModal
        isOpen={showDeleteConfirmModal}
        providerId={providerToDelete}
        providerName={providersData[providerToDelete]?.name || providerToDelete}
        onClose={() => setShowDeleteConfirmModal(false)}
        onConfirm={confirmDeleteProvider}
      />
    </Panel>
  );
};

export default ProviderListPanel;
