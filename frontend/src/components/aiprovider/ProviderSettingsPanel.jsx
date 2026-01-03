import React, { useState, useEffect } from 'react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import NotificationModal from '../others/NotificationModal';
import ConfirmationModal from '../others/ConfirmationModal';
import httpClient from '../../utils/httpClient';
import './ProviderSettingsPanel.css';

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
      const customProviders = providersresponse || [];
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
      const result = await httpClient.delete('/api/provider/favorite-models', {
        params: { modelId }
      });
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
        let customProviders = providersresponse || [];
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
        const customProviders = providersresponse || [];
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
          if (apiKeyresponse) {
            setApiKey(apiKeyresponse);
          } else {
            setApiKey('');
          }
          
          if (baseUrlresponse) {
            setBaseUrl(baseUrlresponse);
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
    <div className="provider-settings-panel">
      <PanelGroup direction="horizontal" className="provider-panel-group">
        {/* 左侧提供商列表面板 */}
        <Panel defaultSize={25} minSize={0} maxSize={100} className="provider-list-panel">
          <div className="provider-list">
            {providers.map((provider, index) => (
              <div
                key={index}
                className={`provider-item ${selectedProviderId === provider ? 'selected' : ''}`}
                onClick={() => handleProviderClick(provider)}
              >
                {provider}
              </div>
            ))}
            {/* 自定义提供商按钮 */}
            <div className="custom-provider-button" onClick={() => setShowCustomProviderModal(true)}>
              + 自定义提供商
            </div>
          </div>
        </Panel>
        <PanelResizeHandle className="provider-panel-resize-handle" />
        {/* 右侧模型列表面板 */}
        <Panel className='model-list-panel'>
          {selectedProviderId && (
            <div className='api-url-input'>
              <form onSubmit={handleSubmit}>
                <label htmlFor="api-input" className="api-label">API Key:</label>
                <input
                  type='password'
                  id='api-input'
                  className="api-key-input"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="请输入 API Key"
                />
                <label htmlFor="url-input" className="url-label">Base URL:</label>
                <input
                  type='text'
                  id='url-input'
                  className="base-url-input"
                  value={baseUrl}
                  onChange={(e) => setBaseUrl(e.target.value)}
                  placeholder="请输入 Base URL"
                />
                <button type="submit" className="api-submit-btn">确定</button>
              </form>
            </div>
          )}
          {selectedProviderId && (
            <div className="provider-actions-container">
              <button
                type="button"
                className="refresh-models-btn"
                onClick={fetchProviderModels}
              >
                刷新模型列表
              </button>
              <button
                type="button"
                className="delete-provider-btn"
                onClick={() => handleDeleteProvider(selectedProviderId)}
              >
                删除此提供商
              </button>
            </div>
          )}
          <div className="model-list">
            {modelError ? (
              <div className="error-message" style={{color: '#ff6b6b', padding: '10px', backgroundColor: '#ffe0e0', borderRadius: '4px', margin: '10px 0'}}>
                {modelError}
              </div>
            ) : (
              providerModels.map((model, index) => (
                <div
                  key={index}
                  className={`model-item ${selectedModelId === model.id?'selected': ''}`}
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
        <NotificationModal
          message={notificationMessage}
          onClose={() => setShowNotification(false)}
        />
      )}
      
      {/* 自定义提供商模态框 */}
      {showCustomProviderModal && (
        <div className="custom-provider-modal-overlay">
          <div className="custom-provider-modal">
            <div className="custom-provider-modal-header">
              <h3>添加自定义提供商</h3>
              <button
                className="custom-provider-modal-close"
                onClick={() => setShowCustomProviderModal(false)}
              >
                ×
              </button>
            </div>
            <form onSubmit={handleCustomProviderSubmit} className="custom-provider-form">
              <div className="form-group">
                <label htmlFor="provider-name">提供商名称:</label>
                <input
                  type="text"
                  id="provider-name"
                  value={customProviderName}
                  onChange={(e) => setCustomProviderName(e.target.value)}
                  placeholder="例如: 我的提供商"
                  required
                />
              </div>
              <div className="form-actions">
                <button type="button" onClick={() => setShowCustomProviderModal(false)}>
                  取消
                </button>
                <button type="submit">
                  确定
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      
      {/* 删除确认模态框 */}
      {showDeleteConfirmModal && (
        <ConfirmationModal
          message={`确定要删除提供商 "${providerToDelete}" 吗？此操作不可撤销。`}
          onConfirm={confirmDeleteProvider}
          onCancel={cancelDeleteProvider}
        />
      )}
    </div>
  );
};

export default ProviderSettingsPanel;