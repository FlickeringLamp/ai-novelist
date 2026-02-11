import { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import type { RootState } from '../../store/store';
import { setAllProvidersData, setSelectedProviderId as setSelectedProviderIdAction, setSelectedModelId as setSelectedModelIdAction } from '../../store/provider';
import httpClient from '../../utils/httpClient';

const ModelSelectorPanel = () => {
  const dispatch = useDispatch();
  const [modelSelectorExpanded, setModelSelectorExpanded] = useState(false);
  
  // 从Redux获取provider数据
  const allProvidersData = useSelector((state: RootState) => state.providerSlice.allProvidersData);
  const selectedProviderId = useSelector((state: RootState) => state.providerSlice.selectedProviderId);
  const selectedModelId = useSelector((state: RootState) => state.providerSlice.selectedModelId);

  // 加载provider数据
  useEffect(() => {
    const loadProviders = async () => {
      try {
        const providersResult = await httpClient.get('/api/provider/providers');
        dispatch(setAllProvidersData(providersResult));
      } catch (error) {
        console.error('加载提供商数据失败:', error);
      }
    };
    loadProviders();
  }, [dispatch]);

  // 加载当前选中的模型
  useEffect(() => {
    const loadSelectedModel = async () => {
      try {
        const selectedModelData = await httpClient.get('/api/chat/selected-model');
        if (selectedModelData.selectedModel) {
          dispatch(setSelectedModelIdAction(selectedModelData.selectedModel));
        }
        if (selectedModelData.selectedProvider) {
          dispatch(setSelectedProviderIdAction(selectedModelData.selectedProvider));
        }
      } catch (error) {
        console.error('加载选中模型失败:', error);
      }
    };
    loadSelectedModel();
  }, [dispatch]);

  // 获取所有启用的提供商
  const enabledProviders = Object.entries(allProvidersData)
    .filter(([_, provider]: [string, any]) => provider.enable)
    .map(([id, provider]: [string, any]) => ({
      id,
      name: provider.name || id,
      ...provider
    }));

  // 初始化默认选中的提供商
  useEffect(() => {
    if (enabledProviders.length > 0 && !selectedProviderId) {
      dispatch(setSelectedProviderIdAction(enabledProviders[0].id));
    }
  }, [enabledProviders, selectedProviderId, dispatch]);

  // 获取当前选中提供商的chat模型
  const currentProviderModels = selectedProviderId
    ? allProvidersData[selectedProviderId as string]?.favoriteModels?.chat || {}
    : {};

  // 处理提供商选择
  const handleProviderSelect = (providerId: string) => {
    dispatch(setSelectedProviderIdAction(providerId));
  };

  // 处理模型选择
  const handleModelSelect = async (modelId: string) => {
    try {
      await httpClient.post('/api/chat/selected-model', {
        selectedModel: modelId,
        selectedProvider: selectedProviderId
      });
      dispatch(setSelectedModelIdAction(modelId));
      setModelSelectorExpanded(false);
    } catch (error) {
      console.error('处理模型选择失败:', error);
    }
  };

  return (
    <>
      {/* 模型选择面板按钮 */}
      <button
        className="flex items-center justify-center gap-2 p-2 w-[40%] bg-theme-black border border-theme-gray3 rounded-[8px] cursor-pointer transition-all min-h-[36px] hover:border-theme-green hover:bg-theme-gray1"
        title="模型选择"
        onClick={() => setModelSelectorExpanded(!modelSelectorExpanded)}
      >
        <span className="text-theme-green text-[14px] whitespace-nowrap overflow-hidden text-ellipsis">
          {selectedModelId || '选择模型'}
        </span>
      </button>

      {/* 模型选择面板 */}
      {modelSelectorExpanded && (
        <div className="absolute top-[5%] bottom-0 left-0 right-0 bg-theme-black border border-theme-gray3 z-[200] flex flex-col">
          {/* 提供商列表 */}
          <div className="h-[15%] p-4 border-b border-theme-gray1 overflow-x-auto">
            <div className="text-theme-white text-sm mb-3">选择提供商</div>
            <div className="flex gap-2">
              {enabledProviders.map((provider) => (
                <button
                  key={provider.id}
                  className={`px-4 py-2 border rounded-small text-sm cursor-pointer transition-all whitespace-nowrap ${
                    selectedProviderId === provider.id
                      ? 'bg-theme-green text-theme-white border-theme-green'
                      : 'border-theme-gray1 text-theme-white hover:bg-theme-gray1'
                  }`}
                  onClick={() => handleProviderSelect(provider.id)}
                >
                  {provider.name}
                </button>
              ))}
            </div>
          </div>

          {/* 模型列表 */}
          <div className="flex-1 p-4 overflow-y-auto">
            <div className="text-theme-white text-sm mb-3">
              {selectedProviderId ? (allProvidersData[selectedProviderId as string]?.name || '') : ''} - 聊天模型
            </div>
            <div className="flex flex-col gap-2">
              {Object.entries(currentProviderModels).map(([modelId, contextLength]) => (
                <button
                  key={modelId}
                  className="flex items-center justify-between p-3 bg-theme-gray1 border border-theme-gray1 rounded-small cursor-pointer transition-all hover:border-theme-green"
                  onClick={() => handleModelSelect(modelId)}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-theme-white text-[14px]">{modelId}</span>
                  </div>
                  <div className="text-theme-gray4 text-[12px]">
                    上下文: {typeof contextLength === 'number' ? contextLength.toLocaleString() : '未知'}
                  </div>
                </button>
              ))}
              {Object.keys(currentProviderModels).length === 0 && (
                <div className="text-center text-theme-gray2 text-sm py-8">
                  该提供商暂无聊天模型
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ModelSelectorPanel;
