import { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSearch, faSyncAlt, faRobot } from '@fortawesome/free-solid-svg-icons';
import httpClient from '../../../utils/httpClient.ts';
import { isEmbeddingModel } from '../../../utils/embeddingModelUtils.ts';

interface Model {
    id: string;
    name: string;
    provider: string;
}

const ModelSelectorPanel = () => {
  // 本地状态管理 - 不再使用Redux
  const [availableModels, setAvailableModels] = useState<Model[]>([]);
  const [searchText, setSearchText] = useState('');
  const [selectedProvider, setSelectedProvider] = useState('');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [selectedModel, setSelectedModel] = useState('');

  // 转换后端模型数据格式
  const convertBackendModels = (backendModels: Record<string, any>): Model[] => {
    if (!backendModels || typeof backendModels !== 'object') return [];
    
    const models: Model[] = [];
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
      const favoriteModels = await httpClient.get('/api/provider/favorite-models');
      
      const models = convertBackendModels(favoriteModels);
      const filteredModels = models.filter(model => !isEmbeddingModel(model.id));
      setAvailableModels(filteredModels);
      console.log('ModelSelectorPanel: 从后端获取到模型数据:', {
        availableModelsCount: filteredModels.length,
        availableModels: filteredModels
      });
    } catch (error) {
      console.error('加载模型列表失败:', error);
    } finally {
      setLoading(false);
    }
  };

  // 加载选中的模型
  const loadSelectedModel = async () => {
    try {
      const selectedModelData = await httpClient.get('/api/config/ai/selected-model');
      setSelectedModel(selectedModelData.selectedModel || '');
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
  const handleModelSelect = async (modelId: string) => {
    try {
      const selectedModelInfo = availableModels.find(model => model.id === modelId);
      const provider = selectedModelInfo?.provider || '';
      
      await httpClient.post('/api/config/ai/selected-model', {
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
  const providers = (): string[] => {
    const uniqueProviders = [...new Set(availableModels.map(model => model.provider))];
    return uniqueProviders.sort();
  };

  // 过滤模型
  const filteredModels = (): Model[] => {
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
  };

  // 处理搜索输入变化
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchText(e.target.value);
  };

  // 处理提供商选择
  const handleProviderSelect = (provider: string) => {
    setSelectedProvider(provider === selectedProvider ? '' : provider);
  };

  // 组件挂载时加载模型列表和选中的模型
  useEffect(() => {
    loadAvailableModels();
    loadSelectedModel();
  }, []);

  return (
    <div className="relative">
      <button
        className="flex items-center justify-center gap-2 w-full p-2 p-2.5-[12px] bg-theme-black border border-theme-gray1 rounded-small cursor-pointer transition-all min-h-[36px] hover:border-theme-green hover:bg-theme-gray1"
        onClick={() => setIsVisible(!isVisible)}
        title="模型选择"
      >
        {selectedModel ? (
          <span className="text-theme-white text-[14px] font-medium whitespace-nowrap overflow-hidden text-ellipsis">{selectedModel}</span>
        ) : (
          <>
            <FontAwesomeIcon icon={faRobot} className="text-theme-white" />
            <span className="text-theme-white text-[14px]">选择模型</span>
          </>
        )}
      </button>
      
      {isVisible && (
        <div className="absolute top-full left-[-10px] right-[-150px] w-[400px] bg-theme-black border border-theme-gray1 rounded-small shadow-deep z-[1000] mt-1 flex flex-col overflow-hidden max-h-[500px]">
          {/* 搜索和过滤区域 */}
          <div className="p-3 border-b border-theme-gray1">
            <div className="flex items-center gap-2 mb-3">
              <FontAwesomeIcon icon={faSearch} className="text-theme-white text-[12px]" />
              <input
                type="text"
                placeholder="搜索模型名称或提供商..."
                value={searchText}
                onChange={handleSearchChange}
                className="flex-1 p-2.5 bg-transparent border border-theme-gray1 rounded-small text-theme-white text-[14px] outline-none placeholder:text-theme-white"
              />
              <button
                className="flex items-center justify-center w-8 h-8 bg-transparent border-none text-theme-white cursor-pointer transition-all hover:text-theme-green disabled:text-theme-white disabled:cursor-not-allowed"
                onClick={handleRefreshModels}
                title="刷新模型列表"
                disabled={refreshing}
              >
                <FontAwesomeIcon icon={faSyncAlt} spin={refreshing} />
              </button>
            </div>
            
            {/* 提供商筛选 */}
            <div className="flex items-center gap-2">
              <span className="text-theme-white text-[12px]">提供商：</span>
              <div className="flex flex-wrap gap-1">
                {providers().map(provider => (
                  <button
                    key={provider}
                    className={`px-2 py-1 border border-theme-gray1 rounded-small text-[12px] cursor-pointer transition-all ${selectedProvider === provider ? 'bg-theme-green text-theme-white border-theme-green' : 'text-theme-white hover:bg-theme-gray1'}`}
                    onClick={() => handleProviderSelect(provider)}
                  >
                    {provider}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 模型列表 */}
          <div className="flex-1 overflow-y-auto p-2">
            {loading ? (
              <div className="flex items-center justify-center p-4 text-theme-white text-[14px]">
                正在加载模型列表...
              </div>
            ) : filteredModels().length === 0 ? (
              <div className="flex items-center justify-center p-4 text-theme-white text-[14px]">
                {searchText || selectedProvider ? '没有找到匹配的模型' : '暂无可用模型'}
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-2">
                {filteredModels().map((model) => (
                  <div
                    key={model.id}
                    className="p-2.5 border border-theme-gray1 rounded-small cursor-pointer transition-all hover:bg-theme-gray1 hover:border-theme-green"
                    onClick={() => handleModelSelect(model.id)}
                  >
                    <div className="flex flex-col gap-1">
                      <div className="text-theme-white text-[14px] font-medium truncate">{model.id}</div>
                      <div className="text-theme-white text-[12px]">{model.provider}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            
            {/* 搜索结果统计 */}
            {searchText && (
              <div className="mt-2 text-center text-theme-white text-[12px]">
                找到 {filteredModels().length} 个匹配的模型
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ModelSelectorPanel;
