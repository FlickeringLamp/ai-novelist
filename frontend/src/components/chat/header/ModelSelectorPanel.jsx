import React, { useState, useMemo, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSearch, faSyncAlt, faRobot } from '@fortawesome/free-solid-svg-icons';
import httpClient from '../../../utils/httpClient';
import { isEmbeddingModel } from '../../../utils/embeddingModelUtils';
import './ModelSelectorPanel.css';

const ModelSelectorPanel = () => {
  // 本地状态管理 - 不再使用Redux
  const [availableModels, setAvailableModels] = useState([]);
  const [searchText, setSearchText] = useState('');
  const [selectedProvider, setSelectedProvider] = useState('');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [selectedModel, setSelectedModel] = useState('');

  // 转换后端模型数据格式
  const convertBackendModels = (backendModels) => {
    if (!backendModels || typeof backendModels !== 'object') return [];
    
    const models = [];
    for (const [modelId, modelInfo] of Object.entries(backendModels)) {
      if (!modelInfo || typeof modelInfo !== 'object') continue;
      
      models.push({
        id: modelId,
        name: modelInfo.name || modelId,
        provider: modelInfo.provider || 'unknown'
      });
    }
    
    return models;
  };

  // 加载模型列表
  const loadAvailableModels = async () => {
    try {
      setLoading(true);
      const result = await httpClient.get('/api/provider/favorite-models');
      
      if (result.success) {
        const models = convertBackendModels(result.data);
        const filteredModels = models.filter(model => !isEmbeddingModel(model.id));
        setAvailableModels(filteredModels);
        console.log('ModelSelectorPanel: 从后端获取到模型数据:', {
          availableModelsCount: filteredModels.length,
          availableModels: filteredModels
        });
      } else {
        console.error('获取模型列表失败:', result.error);
      }
    } catch (error) {
      console.error('加载模型列表失败:', error);
    } finally {
      setLoading(false);
    }
  };

  // 加载选中的模型
  const loadSelectedModel = async () => {
    try {
      const response = await httpClient.get('/api/ai-config/selected-model');
      setSelectedModel(response.data.selectedModel || '');
    } catch (error) {
      console.error('加载选中模型失败:', error);
    }
  };

  // 刷新模型列表
  const handleRefreshModels = async () => {
    try {
      setRefreshing(true);
      await loadAvailableModels();
    } catch (error) {
      console.error('刷新模型列表失败:', error);
    } finally {
      setRefreshing(false);
    }
  };

  // 处理模型选择
  const handleModelSelect = async (modelId) => {
    try {
      const selectedModelInfo = availableModels.find(model => model.id === modelId);
      const provider = selectedModelInfo?.provider || '';
      
      await httpClient.post('/api/ai-config/selected-model', {
        selectedModel: modelId,
        selectedProvider: provider
      });
      
      console.log(`模型选择已保存: ${modelId}`);
      setSelectedModel(modelId);
      setIsVisible(false);
    } catch (error) {
      console.error('处理模型选择失败:', error);
    }
  };

  // 获取所有提供商列表
  const providers = useMemo(() => {
    const uniqueProviders = [...new Set(availableModels.map(model => model.provider))];
    return uniqueProviders.sort();
  }, [availableModels]);

  // 过滤模型
  const filteredModels = useMemo(() => {
    let filtered = availableModels;
    
    // 按搜索文本过滤
    if (searchText) {
      filtered = filtered.filter(model => 
        model.id.toLowerCase().includes(searchText.toLowerCase()) ||
        model.provider.toLowerCase().includes(searchText.toLowerCase())
      );
    }
    
    // 按提供商过滤
    if (selectedProvider) {
      filtered = filtered.filter(model => model.provider === selectedProvider);
    }
    
    return filtered;
  }, [availableModels, searchText, selectedProvider]);

  // 处理搜索输入变化
  const handleSearchChange = (e) => {
    setSearchText(e.target.value);
  };

  // 处理提供商选择
  const handleProviderSelect = (provider) => {
    setSelectedProvider(provider === selectedProvider ? '' : provider);
  };

  // 组件挂载时加载模型列表和选中的模型
  useEffect(() => {
    loadAvailableModels();
    loadSelectedModel();
  }, []);

  return (
    <div className="model-selector-container">
      <button
        className="model-button"
        onClick={() => setIsVisible(!isVisible)}
        title="模型选择"
      >
        {selectedModel ? (
          <span className="model-name-text">{selectedModel}</span>
        ) : (
          <>
            <FontAwesomeIcon icon={faRobot} />
            <span className="model-select-hint">选择模型</span>
          </>
        )}
      </button>
      
      {isVisible && (
        <div className="model-selector-panel">
          {/* 搜索和过滤区域 */}
          <div className="model-filter-section">
            <div className="search-container">
              <FontAwesomeIcon icon={faSearch} className="search-icon" />
              <input
                type="text"
                placeholder="搜索模型名称或提供商..."
                value={searchText}
                onChange={handleSearchChange}
                className="search-input"
              />
              <button
                className={`refresh-button ${refreshing ? 'refreshing' : ''}`}
                onClick={handleRefreshModels}
                title="刷新模型列表"
                disabled={refreshing}
              >
                <FontAwesomeIcon icon={faSyncAlt} spin={refreshing} />
              </button>
            </div>
            
            {/* 提供商筛选 */}
            <div className="provider-filter">
              <span className="filter-label">提供商：</span>
              <div className="provider-tags">
                {providers.map(provider => (
                  <button
                    key={provider}
                    className={`provider-tag ${selectedProvider === provider ? 'active' : ''}`}
                    onClick={() => handleProviderSelect(provider)}
                  >
                    {provider}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 模型列表 */}
          <div className="model-list-container">
            {loading ? (
              <div className="loading-state">
                正在加载模型列表...
              </div>
            ) : filteredModels.length === 0 ? (
              <div className="empty-state">
                {searchText || selectedProvider ? '没有找到匹配的模型' : '暂无可用模型'}
              </div>
            ) : (
              <div className="model-grid">
                {filteredModels.map((model) => (
                  <div
                    key={model.id}
                    className="model-card"
                    onClick={() => handleModelSelect(model.id)}
                  >
                    <div className="model-info">
                      <div className="model-name">{model.id}</div>
                      <div className="model-provider">{model.provider}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            
            {/* 搜索结果统计 */}
            {searchText && (
              <div className="search-results-info">
                找到 {filteredModels.length} 个匹配的模型
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ModelSelectorPanel;
