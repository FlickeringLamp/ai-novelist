import { useState, useEffect } from 'react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import UnifiedModal from '../others/UnifiedModal';
import httpClient from '../../utils/httpClient';

const ProviderSettingsPanel = () => {
  const [providers, setProviders] = useState([]);
  const [providerModels, setProviderModels] = useState([]);
  const [selectedProviderId, setSelectedProviderId] = useState(null);
  const [selectedModelId, setSelectedModelId] = useState(null);
  const [apiKey, setApiKey] = useState('')
  const [baseUrl, setBaseUrl] = useState('')
  const [submitStatus, setSubmitStatus] = useState({ success: null, message: '' })
  const [modelError, setModelError] = useState('')
  const [favoriteModels, setFavoriteModels] = useState({})
  const [showNotification, setShowNotification] = useState(false)
  const [notificationMessage, setNotificationMessage] = useState('')

  // 自定义提供商相关状态
  const [showCustomProviderModal, setShowCustomProviderModal] = useState(false);
  const [customProviderName, setCustomProviderName] = useState('');

  // 删除确认模态框相关状态
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
  const [providerToDelete, setProviderToDelete] = useState('');

  useEffect(() => {
    const fetchProviders = async () => {
      const result = await httpClient.get('/api/provider/providers');
      if (result.success) {
        setProviders(result.data || []);
      }
    };
    fetchProviders();
  }, []);

  // 加载常用模型列表
  useEffect(() => {
    const loadFavoriteModels = async () => {
      const result = await httpClient.get('/api/provider/favorite-models');
      if (result.success) {
        setFavoriteModels(result.data || {});
      }
    };
    loadFavoriteModels();
  }, []);

  // 当切换提供商时，清理模型列表和错误状态
  useEffect(() => {
    setProviderModels([]);
    setModelError('');
    setSelectedModelId(null);
  }, [selectedProviderId]);

  // 手动获取模型列表的函数
  const fetchProviderModels = async () => {
    if (!selectedProviderId) return;
    setModelError(''); // 清除之前的错误
    try {
      const result = await httpClient.get(`/api/provider/${selectedProviderId}/models`);
      if (result.success) {
        setProviderModels(result.data.models || []);
        setModelError('');
      } else {
        setProviderModels([]);
        setModelError(result.error || '获取模型列表失败');
      }
    } catch (error) {
      setProviderModels([]);
      setModelError('获取模型列表失败: ' + error.message);
    }
  };
  // 处理删除提供商
  const handleDeleteProvider = (providerId) => {
    setProviderToDelete(providerId);
    setShowDeleteConfirmModal(true);
  };

  // 确认删除提供商
  const confirmDeleteProvider = async () => {
    try {
      // 检查是否是自定义提供商
      const providersResponse = await httpClient.get(`/api/config/store?key=${encodeURIComponent('customProviders')}`);
      const customProviders = providersResponse.data || [];
      const isCustomProvider = customProviders.some(provider => provider.name === providerToDelete);

      if (isCustomProvider) {
        // 删除自定义提供商
        const result = await httpClient.delete(`/api/provider/custom-providers/${providerToDelete}`);

        if (result.success) {
          // 刷新提供商列表
          const providersResult = await httpClient.get('/api/provider/providers');
          if (providersResult.success) {
            setProviders(providersResult.data || []);
          }

          // 如果删除的是当前选中的提供商，清空选中状态
          if (selectedProviderId === providerToDelete) {
            setSelectedProviderId(null);
            setProviderModels([]);
            setApiKey('');
            setBaseUrl('');
          }

          setNotificationMessage(`提供商 "${providerToDelete}" 删除成功`);
          setShowNotification(true);
        } else {
          setNotificationMessage(`删除失败: ${result.error}`);
          setShowNotification(true);
        }
      } else {
        setNotificationMessage('内置提供商不能删除');
        setShowNotification(true);
      }
    } catch (error) {
      setNotificationMessage(`删除失败: ${error.message}`);
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

  const handleProviderClick = (providerId) => {
    setSelectedProviderId(providerId);
  };
  const handleModelClick = (modelId) =>{
    setSelectedModelId(modelId)
  }

  // 处理常用模型勾选
  const handleFavoriteToggle = async (modelId, provider) => {
    const isFavorite = modelId in favoriteModels;

    if (isFavorite) {
      // 从常用列表中移除
      const result = await httpClient.delete(`/api/provider/favorite-models?modelId=${encodeURIComponent(modelId)}`);
      if (result.success) {
        setFavoriteModels(result.data || {});
      }
    } else {
      // 添加到常用列表
      const result = await httpClient.post('/api/provider/favorite-models', {
        modelId,
        provider
      });
      if (result.success) {
        setFavoriteModels(result.data || {});
      }
    }
  }
  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      // 内置提供商列表
      const builtinProviders = ['deepseek', 'openrouter', 'aliyun', 'siliconflow', 'zhipuai', 'kimi', 'ollama', 'gemini'];
      const isBuiltinProvider = builtinProviders.includes(selectedProviderId);

      if (!isBuiltinProvider) {
        // 对于自定义提供商，使用customProviders数组
        const providersResponse = await httpClient.get(`/api/config/store?key=${encodeURIComponent('customProviders')}`);
        let customProviders = providersResponse.data || [];
        const existingProviderIndex = customProviders.findIndex(provider => provider.name === selectedProviderId);

        if (existingProviderIndex !== -1) {
          // 更新现有的自定义提供商
          customProviders[existingProviderIndex] = {
            ...customProviders[existingProviderIndex],
            apiKey: apiKey,
            baseUrl: baseUrl
          };
        } else {
          // 如果不在customProviders数组中，创建一个新的条目
          customProviders.push({
            name: selectedProviderId,
            apiKey: apiKey,
            baseUrl: baseUrl
          });
        }

        // 保存更新后的customProviders数组
        await httpClient.post('/api/config/store', {
          key: 'customProviders',
          value: customProviders
        });
        setSubmitStatus({
          success: true,
          message: `${selectedProviderId} 配置保存成功`
        });
        setNotificationMessage(`${selectedProviderId} 配置保存成功`);
        setShowNotification(true);
      } else {
        // 对于内置提供商，使用原来的方式
        const apiKeyConfigKey = `${selectedProviderId}ApiKey`;
        const baseUrlConfigKey = `${selectedProviderId}BaseUrl`;

        await Promise.all([
          httpClient.post('/api/config/store', { key: apiKeyConfigKey, value: apiKey }),
          httpClient.post('/api/config/store', { key: baseUrlConfigKey, value: baseUrl })
        ]);
        setSubmitStatus({
          success: true,
          message: `${selectedProviderId} 配置保存成功`
        });
        setNotificationMessage(`${selectedProviderId} 配置保存成功`);
        setShowNotification(true);
      }
    } catch (error) {
      setSubmitStatus({
        success: false,
        message: `保存失败: ${error.message}`
      });
    }
  }

  // 处理自定义提供商提交
  const handleCustomProviderSubmit = async (e) => {
    e.preventDefault();
    try {
      const result = await httpClient.post('/api/provider/custom-providers', {
        name: customProviderName,
        baseUrl: '',
        apiKey: ''
      });

      if (result.success) {
        // 刷新提供商列表
        const providersResult = await httpClient.get('/api/provider/providers');
        if (providersResult.success) {
          setProviders(providersResult.data || []);
        }

        // 重置表单并关闭模态框
        setCustomProviderName('');
        setShowCustomProviderModal(false);

        // 显示成功通知
        setNotificationMessage('自定义提供商添加成功');
        setShowNotification(true);
      } else {
        setNotificationMessage(`添加失败: ${result.error}`);
        setShowNotification(true);
      }
    } catch (error) {
      setNotificationMessage(`添加失败: ${error.message}`);
      setShowNotification(true);
    }
  };

  // 加载当前选中的提供商的API key和base URL
  useEffect(() => {
    const loadProviderConfig = async () => {
      if (!selectedProviderId) {
        setApiKey('');
        setBaseUrl('');
        return;
      }
      try {
        // 检查是否是自定义提供商
        const providersResponse = await httpClient.get(`/api/config/store?key=${encodeURIComponent('customProviders')}`);
        const customProviders = providersResponse.data || [];
        const customProvider = customProviders.find(provider => provider.name === selectedProviderId);

        if (customProvider) {
          // 对于自定义提供商，从customProviders数组中获取配置
          setApiKey(customProvider.apiKey || '');
          setBaseUrl(customProvider.baseUrl || '');
        } else {
          // 对于内置提供商，使用原来的方式
          const apiKeyConfigKey = `${selectedProviderId}ApiKey`;
          const baseUrlConfigKey = `${selectedProviderId}BaseUrl`;

          const [apiKeyResponse, baseUrlResponse] = await Promise.all([
            httpClient.get(`/api/config/store?key=${encodeURIComponent(apiKeyConfigKey)}`),
            httpClient.get(`/api/config/store?key=${encodeURIComponent(baseUrlConfigKey)}`)
          ]);

          // 检查返回结果结构
          if (apiKeyResponse.data) {
            setApiKey(apiKeyResponse.data);
          } else {
            setApiKey('');
          }

          if (baseUrlResponse.data) {
            setBaseUrl(baseUrlResponse.data);
          } else {
            // 如果没有自定义URL，对于内置提供商，使用默认URL
            if (selectedProviderId === 'deepseek') {
              setBaseUrl('https://api.deepseek.com/v1');
            } else if (selectedProviderId === 'ollama') {
              setBaseUrl('http://127.0.0.1:11434');
            } else if (selectedProviderId === 'aliyun') {
              setBaseUrl('https://dashscope.aliyuncs.com/compatible-mode/v1');
            } else if (selectedProviderId === 'openrouter') {
              setBaseUrl('https://openrouter.ai/api/v1');
            } else if (selectedProviderId === 'siliconflow') {
              setBaseUrl('https://api.siliconflow.cn/v1');
            } else if (selectedProviderId === 'kimi') {
              setBaseUrl('https://api.moonshot.cn/v1');
            } else if (selectedProviderId === 'zhipuai') {
              setBaseUrl('https://open.bigmodel.cn/api/paas/v4/');
            } else {
              setBaseUrl('');
            }
          }
        }
      } catch (error) {
        console.error('加载提供商配置失败:', error);
        setApiKey('');
        setBaseUrl('');
      }
    };

    loadProviderConfig();
  }, [selectedProviderId]);

  return (
    <div className="w-full">
      <PanelGroup direction="horizontal" className="pt-2.5">
        {/* 左侧提供商列表面板 */}
        <Panel defaultSize={25} minSize={0} maxSize={100} className="border border-theme-gray1 flex flex-col h-[932px]">
          <div className="overflow-y-auto flex-1 p-1.25">
            {providers.map((provider, index) => (
              <div
                key={index}
                className={`m-2.5 p-2.5 text-center cursor-pointer bg-theme-gray1 ${selectedProviderId === provider ? 'border border-theme-green text-theme-green' : ''}`}
                onClick={() => handleProviderClick(provider)}
              >
                {provider}
              </div>
            ))}
            {/* 自定义提供商按钮 */}
            <div className="m-2.5 p-2.5 text-center cursor-pointer bg-theme-gray1 hover:bg-theme-gray1" onClick={() => setShowCustomProviderModal(true)}>
              + 自定义提供商
            </div>
          </div>
        </Panel>
        <PanelResizeHandle className="w-1.25 bg-theme-gray1 cursor-col-resize relative transition-colors hover:bg-theme-gray1 after:content-[''] after:absolute after:top-1/2 after:left-1/2 after:-translate-x-1/2 after:-translate-y-1/2 after:w-0.5 after:h-5 after:bg-theme-gray1 after:rounded-[1px]" />
        {/* 右侧模型列表面板 */}
        <Panel className='border border-theme-gray1 flex flex-col h-[932px]'>
          {selectedProviderId && (
            <div className='block mx-auto my-5 bg-theme-gray1 p-2.5 rounded-small w-[80%]'>
              <form onSubmit={handleSubmit}>
                <label htmlFor="api-input" className="block mx-auto my-2.5 mb-1.25 text-theme-white w-[80%] text-left">API Key:</label>
                <input
                  type='password'
                  id='api-input'
                  className="block mx-auto my-2.5 border-0 h-[25px] w-[80%] bg-theme-gray1"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="请输入 API Key"
                />
                <label htmlFor="url-input" className="block mx-auto my-2.5 mb-1.25 text-theme-white w-[80%] text-left">Base URL:</label>
                <input
                  type='text'
                  id='url-input'
                  className="block mx-auto my-2.5 border-0 h-[25px] w-[80%] bg-theme-gray1"
                  value={baseUrl}
                  onChange={(e) => setBaseUrl(e.target.value)}
                  placeholder="请输入 Base URL"
                />
                <button type="submit" className="block mx-auto my-3.75 px-4 py-2 bg-theme-green text-white border-none rounded-small cursor-pointer hover:bg-theme-green">确定</button>
              </form>
            </div>
          )}
          {selectedProviderId && (
            <div className="mx-auto my-2.5 w-[80%] flex gap-2.5">
              <button
                type="button"
                className="flex-1 px-4 py-2 bg-theme-green text-white border-none rounded-small cursor-pointer"
                onClick={fetchProviderModels}
              >
                刷新模型列表
              </button>
              <button
                type="button"
                className="flex-1 px-4 py-2 bg-red-500 text-white border-none rounded-small cursor-pointer hover:bg-red-600"
                onClick={() => handleDeleteProvider(selectedProviderId)}
              >
                删除此提供商
              </button>
            </div>
          )}
          <div className="overflow-y-auto flex-1 p-1.25">
            {modelError ? (
              <div className="p-2.5 rounded-small m-2.5" style={{color: '#ff6b6b', backgroundColor: '#ffe0e0'}}>
                {modelError}
              </div>
            ) : (
              providerModels.map((model, index) => (
                <div
                  key={index}
                  className={`m-2.5 cursor-pointer ${selectedModelId === model.id?'border border-theme-green text-theme-green': ''}`}
                >
                  <input
                    type="checkbox"
                    checked={model.id in favoriteModels}
                    onChange={(e) => {
                      e.stopPropagation();
                      handleFavoriteToggle(model.id, selectedProviderId);
                    }}
                    className="model-checkbox"
                  />
                  <span
                    onClick={() => handleModelClick(model.id)}
                    className="model-name"
                  >
                    {model.id}
                  </span>
                </div>
              ))
            )}
          </div>
        </Panel>
      </PanelGroup>

      {/* 通知弹窗 */}
      {showNotification && (
        <UnifiedModal
          message={notificationMessage}
          onConfirm={() => setShowNotification(false)}
          onCancel={() => setShowNotification(false)}
        />
      )}

      {/* 自定义提供商模态框 */}
      {showCustomProviderModal && (
        <div className="fixed top-0 left-0 right-0 bottom-0 bg-black/50 flex justify-center items-center z-[1000]">
          <div className="bg-theme-gray1 rounded-medium shadow-medium w-[400px] max-w-[90vw] text-theme-white">
            <div className="flex justify-between items-center px-5 py-3.75 border-b border-theme-gray1">
              <h3 className="m-0 text-theme-white text-lg">添加自定义提供商</h3>
              <button
                className="bg-none border-none text-xl text-theme-white cursor-pointer p-1.25 hover:text-theme-white"
                onClick={() => setShowCustomProviderModal(false)}
              >
                ×
              </button>
            </div>
            <form onSubmit={handleCustomProviderSubmit} className="px-5 py-5">
              <div className="mb-3.75">
                <label htmlFor="provider-name" className="block mb-1.25 text-theme-white">提供商名称:</label>
                <input
                  type="text"
                  id="provider-name"
                  className="w-full p-2 bg-theme-gray1 text-theme-white border border-theme-gray1 rounded-small box-border focus:outline-none focus:border-theme-green"
                  value={customProviderName}
                  onChange={(e) => setCustomProviderName(e.target.value)}
                  placeholder="例如: 我的提供商"
                  required
                />
              </div>
              <div className="flex justify-end gap-2.5 mt-5">
                <button type="button" className="px-4 py-2 border-none rounded-small cursor-pointer text-sm bg-gray-600 text-white hover:bg-gray-700" onClick={() => setShowCustomProviderModal(false)}>
                  取消
                </button>
                <button type="submit" className="px-4 py-2 border-none rounded-small cursor-pointer text-sm bg-theme-green text-white hover:bg-theme-green">
                  确定
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 删除确认模态框 */}
      {showDeleteConfirmModal && (
        <UnifiedModal
          message={`确定要删除提供商 "${providerToDelete}" 吗？此操作不可撤销。`}
          showCancelButton={true}
          onConfirm={confirmDeleteProvider}
          onCancel={cancelDeleteProvider}
        />
      )}
    </div>
  );
};

export default ProviderSettingsPanel;
