import { useState, useEffect } from 'react';
import { PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import UnifiedModal from '../others/UnifiedModal';
import ProviderContextMenu from './ProviderContextMenu';
import ProviderListPanel from './ProviderListPanel';
import ModelListPanel from './ModelListPanel';
import httpClient from '../../utils/httpClient';


const ProviderSettingsPanel = () => {
  const [allProvidersData, setAllProvidersData] = useState<{[key: string]: any}>({});
  const [providers, setProviders] = useState<string[]>([]);
  const [favoriteModels, setFavoriteModels] = useState<{chat: {[key: string]: any}, embedding: {[key: string]: any}, other: {[key: string]: any}}>({chat: {}, embedding: {}, other: {}});
  const [selectedProviderId, setSelectedProviderId] = useState<string | null>(null);
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState('')
  const [baseUrl, setBaseUrl] = useState('')
  const [modelError, setModelError] = useState('')
  const [showNotification, setShowNotification] = useState(false)
  const [notificationMessage, setNotificationMessage] = useState('')

  // 内置提供商列表
  const builtinProviders = ['deepseek', 'ollama', 'aliyun', 'openrouter', 'siliconflow', 'kimi', 'zhipuai'];

  // 自定义提供商相关状态
  const [showCustomProviderModal, setShowCustomProviderModal] = useState(false);
  const [customProviderName, setCustomProviderName] = useState('');

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
  const [newProviderName, setNewProviderName] = useState('');

  // 删除确认模态框相关状态
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
  const [providerToDelete, setProviderToDelete] = useState('');

  useEffect(() => {
    const fetchProviders = async () => {
      const result = await httpClient.get('/api/provider/providers');
      if (result) {
        setAllProvidersData(result);
        setProviders(Object.keys(result || {}));
      }
    };
    fetchProviders();
  }, []);

  // 当切换提供商时，从本地状态获取模型列表
  useEffect(() => {
    setFavoriteModels({chat: {}, embedding: {}, other: {}});
    setModelError('');
    setSelectedModelId(null);
    if (selectedProviderId && allProvidersData[selectedProviderId]) {
      const providerData = allProvidersData[selectedProviderId];
      const models = providerData.favoriteModels || {chat: {}, embedding: {}, other: {}};
      setFavoriteModels(models);
    }
  }, [selectedProviderId, allProvidersData]);
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
  const confirmDeleteProvider = async () => {
    try {
      // 删除自定义提供商
      await httpClient.delete(`/api/provider/custom-providers/${providerToDelete}`);

      // 刷新提供商列表
      const providersResult = await httpClient.get('/api/provider/providers');
      setProviders(providersResult || []);

      // 如果删除的是当前选中的提供商，清空选中状态
      if (selectedProviderId === providerToDelete) {
        setSelectedProviderId(null);
        setFavoriteModels({chat: {}, embedding: {}, other: {}});
        setApiKey('');
        setBaseUrl('');
      }

      setNotificationMessage(`提供商 "${providerToDelete}" 删除成功`);
      setShowNotification(true);
    } catch (error) {
      setNotificationMessage(`删除失败: ${(error as Error).message}`);
      setShowNotification(true);
    } finally {
      setShowDeleteConfirmModal(false);
      setProviderToDelete('');
    }
  };

  // 取消删除
  const cancelDeleteProvider = () => {
    setShowDeleteConfirmModal(false);
    setProviderToDelete('');
  };

  // 处理重命名提供商
  const handleRenameProvider = (providerId: string) => {
    setProviderToRename(providerId);
    setNewProviderName(providerId);
    setShowRenameModal(true);
    closeContextMenu();
  };

  // 确认重命名提供商
  const confirmRenameProvider = async () => {
    try {
      if (!newProviderName.trim()) {
        setNotificationMessage('提供商名称不能为空');
        setShowNotification(true);
        return;
      }

      if (newProviderName === providerToRename) {
        setShowRenameModal(false);
        return;
      }

      // 更新提供商名称
      await httpClient.put(`/api/provider/custom-providers/${providerToRename}`, {
        name: newProviderName
      });

      // 刷新提供商列表
      const providersResult = await httpClient.get('/api/provider/providers');
      setProviders(providersResult || []);

      // 如果重命名的是当前选中的提供商，更新选中状态
      if (selectedProviderId === providerToRename) {
        setSelectedProviderId(newProviderName);
      }

      setNotificationMessage(`提供商重命名成功`);
      setShowNotification(true);
      setShowRenameModal(false);
    } catch (error) {
      setNotificationMessage(`重命名失败: ${(error as Error).message}`);
      setShowNotification(true);
    }
  };

  // 取消重命名
  const cancelRenameProvider = () => {
    setShowRenameModal(false);
    setProviderToRename('');
    setNewProviderName('');
  };

  const handleProviderClick = (providerId: string) => {
    setSelectedProviderId(providerId);
  };
  const handleModelClick = (modelId: string) =>{
    setSelectedModelId(modelId)
  }

  const handleSubmit = async () => {
    if (!selectedProviderId) return;
    try {
      // 对于所有提供商（内置和自定义），统一使用新的嵌套结构 provider.{providerId}.key 和 provider.{providerId}.url
      const apiKeyConfigKey = `provider.${selectedProviderId}.key`;
      const baseUrlConfigKey = `provider.${selectedProviderId}.url`;

      await Promise.all([
        httpClient.post('/api/config/store', { key: apiKeyConfigKey, value: apiKey }),
        httpClient.post('/api/config/store', { key: baseUrlConfigKey, value: baseUrl })
      ]);
      setNotificationMessage(`${selectedProviderId} 配置保存成功`);
      setShowNotification(true);
    } catch (error) {
      setNotificationMessage(`保存失败: ${(error as Error).message}`);
      setShowNotification(true);
    }
  }

  // 处理自定义提供商提交
  const handleCustomProviderSubmit = async () => {
    try {
      await httpClient.post('/api/provider/custom-providers', {
        name: customProviderName,
        url: '',
        key: ''
      });

      // 刷新提供商列表
      const providersResult = await httpClient.get('/api/provider/providers');
      setProviders(providersResult || []);

      // 重置表单并关闭模态框
      setCustomProviderName('');
      setShowCustomProviderModal(false);

      // 显示成功通知
      setNotificationMessage('自定义提供商添加成功');
      setShowNotification(true);
    } catch (error) {
      setNotificationMessage(`添加失败: ${(error as Error).message}`);
      setShowNotification(true);
    }
  };

  // 加载当前选中的提供商的API key和base URL
  useEffect(() => {
    if (!selectedProviderId) {
      setApiKey('');
      setBaseUrl('');
      return;
    }
    const providerData = allProvidersData[selectedProviderId];
    if (providerData) {
      setApiKey(providerData.key || '');
      setBaseUrl(providerData.url || '');
    } else {
      setApiKey('');
      setBaseUrl('');
    }
  }, [selectedProviderId, allProvidersData]);

  return (
    <div className="w-full">
      <PanelGroup direction="horizontal" className="pt-2.5">
        {/* 左侧提供商列表面板 */}
        <ProviderListPanel
          providers={providers}
          selectedProviderId={selectedProviderId}
          onProviderClick={handleProviderClick}
          onContextMenu={handleContextMenu}
          onAddCustomProvider={() => setShowCustomProviderModal(true)}
        />
        <PanelResizeHandle className="w-1.25 bg-theme-gray1 cursor-col-resize relative transition-colors hover:bg-theme-gray1 after:content-[''] after:absolute after:top-1/2 after:left-1/2 after:-translate-x-1/2 after:-translate-y-1/2 after:w-0.5 after:h-5 after:bg-theme-gray1 after:rounded-[1px]" />
        {/* 右侧模型列表面板 */}
        <ModelListPanel
          selectedProviderId={selectedProviderId}
          apiKey={apiKey}
          baseUrl={baseUrl}
          favoriteModels={favoriteModels}
          selectedModelId={selectedModelId}
          modelError={modelError}
          onApiKeyChange={(value) => setApiKey(value)}
          onBaseUrlChange={(value) => setBaseUrl(value)}
          onConfigSubmit={handleSubmit}
          onModelClick={handleModelClick}
        />
      </PanelGroup>

      {/* 通知弹窗 */}
      {showNotification && (
        <UnifiedModal
          message={notificationMessage}
          buttons={[
            { text: '确定', onClick: () => setShowNotification(false), className: 'bg-theme-green' }
          ]}
        />
      )}

      {/* 自定义提供商模态框 */}
      {showCustomProviderModal && (
        <UnifiedModal
          title="添加自定义提供商"
          inputs={[
            {
              label: '提供商名称:',
              type: 'text',
              value: customProviderName,
              onChange: (value) => setCustomProviderName(value),
              placeholder: '例如: 我的提供商',
              required: true
            }
          ]}
          buttons={[
            {
              text: '确定',
              onClick: handleCustomProviderSubmit,
              className: 'bg-theme-green'
            },
            {
              text: '取消',
              onClick: () => setShowCustomProviderModal(false),
              className: 'bg-theme-gray3'
            }
          ]}
        />
      )}

      {/* 右键菜单 */}
      <ProviderContextMenu
        visible={contextMenu.visible}
        x={contextMenu.x}
        y={contextMenu.y}
        providerId={contextMenu.providerId}
        builtinProviders={builtinProviders}
        onRename={handleRenameProvider}
        onDelete={handleDeleteProvider}
        onClose={closeContextMenu}
      />

      {/* 重命名模态框 */}
      {showRenameModal && (
        <UnifiedModal
          title="重命名提供商"
          inputs={[
            {
              label: '新名称:',
              type: 'text',
              value: newProviderName,
              onChange: (value) => setNewProviderName(value),
              placeholder: '请输入新名称',
              required: true
            }
          ]}
          buttons={[
            {
              text: '确定',
              onClick: confirmRenameProvider,
              className: 'bg-theme-green'
            },
            {
              text: '取消',
              onClick: cancelRenameProvider,
              className: 'bg-theme-gray3'
            }
          ]}
        />
      )}

      {/* 删除确认模态框 */}
      {showDeleteConfirmModal && (
        <UnifiedModal
          message={`确定要删除提供商 "${providerToDelete}" 吗？此操作不可撤销。`}
          buttons={[
            { text: '确定', onClick: confirmDeleteProvider, className: 'bg-theme-green' },
            { text: '取消', onClick: cancelDeleteProvider, className: 'bg-theme-gray3' }
          ]}
        />
      )}
    </div>
  );
};

export default ProviderSettingsPanel;
