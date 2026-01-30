import { useState, useEffect } from 'react';
import { Panel } from 'react-resizable-panels';
import { useSelector, useDispatch } from 'react-redux';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEye, faEyeSlash, faMinus } from '@fortawesome/free-solid-svg-icons';
import type { RootState } from '../../store/store';
import { setAllProvidersData } from '../../store/provider';
import httpClient from '../../utils/httpClient';
import AddModelModal from './modals/AddModelModal';


const ModelListPanel = () => {
  const dispatch = useDispatch();

  // 从 Redux 获取状态
  const selectedProviderId = useSelector((state: RootState) => state.providerSlice.selectedProviderId);
  const allProvidersData = useSelector((state: RootState) => state.providerSlice.allProvidersData);

  const [showApiKey, setShowApiKey] = useState(false);
  const [showAddModelModal, setShowAddModelModal] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [modelError, setModelError] = useState('');

  // 获取当前选中的提供商数据
  const currentProviderData = selectedProviderId ? allProvidersData[selectedProviderId] : null;
  const favoriteModels = currentProviderData?.favoriteModels || { chat: {}, embedding: {}, other: {} };
  const isProviderEnabled = currentProviderData?.enable || false;

  // 加载当前选中的提供商的API key和base URL
  useEffect(() => {
    if (!selectedProviderId) {
      setApiKey('');
      setBaseUrl('');
      return;
    }
    if (currentProviderData) {
      setApiKey(currentProviderData.key || '');
      setBaseUrl(currentProviderData.url || '');
    } else {
      setApiKey('');
      setBaseUrl('');
    }
  }, [selectedProviderId, currentProviderData]);

  useEffect(() => {
    setModelError('');
  }, [selectedProviderId]);

  const handleDeleteModel = async (modelId: string, modelType: string) => {
    try {
      await httpClient.post('/api/provider/favorite-models/remove', {
        modelId: modelId,
        provider: selectedProviderId,
        modelType: modelType
      });

      // 刷新提供商列表
      const providersResult = await httpClient.get('/api/provider/providers');
      dispatch(setAllProvidersData(providersResult));
    } catch (error) {
      setModelError(`删除模型失败: ${(error as Error).message}`);
    }
  };

  const handleSubmit = async () => {
    if (!selectedProviderId) return;
    try {
      const apiKeyConfigKey = `provider.${selectedProviderId}.key`;
      const baseUrlConfigKey = `provider.${selectedProviderId}.url`;

      await Promise.all([
        httpClient.post('/api/config/store', { key: apiKeyConfigKey, value: apiKey }),
        httpClient.post('/api/config/store', { key: baseUrlConfigKey, value: baseUrl })
      ]);

      // 刷新提供商列表
      const providersResult = await httpClient.get('/api/provider/providers');
      dispatch(setAllProvidersData(providersResult));
    } catch (error) {
      setModelError(`保存失败: ${(error as Error).message}`);
    }
  };

  const handleToggleProvider = async () => {
    if (!selectedProviderId) return;

    try {
      const newEnableState = !isProviderEnabled;
      await httpClient.put(`/api/provider/custom-providers/${selectedProviderId}`, {
        enable: newEnableState
      });

      // 刷新提供商列表
      const providersResult = await httpClient.get('/api/provider/providers');
      dispatch(setAllProvidersData(providersResult));
    } catch (error) {
      setModelError(`更新提供商状态失败: ${(error as Error).message}`);
    }
  };

  return (
    <Panel className='border border-theme-gray1 flex flex-col h-[932px]'>
      {selectedProviderId && (
        <>
          {/* 启用/禁用提供商开关 */}
          <div className="flex justify-end items-center p-2.5">
            <span className="text-theme-white mr-2.5">启用提供商</span>
            <button
              onClick={handleToggleProvider}
              className={`w-12 h-6 rounded-full transition-colors ${isProviderEnabled ? 'bg-theme-green' : 'bg-theme-gray3'}`}
            >
              <div
                className={`w-5 h-5 bg-white rounded-full transition-transform ${isProviderEnabled ? 'translate-x-6' : 'translate-x-0.5'}`}
              />
            </button>
          </div>
          <div className="mx-auto my-2.5 w-[95%]">
            <div className="text-theme-white text-sm mb-1">API Key</div>
            <div className="relative">
              <input
                type={showApiKey ? 'text' : 'password'}
                className="border-0 h-[25px] bg-theme-gray2 w-full pr-8 p-3"
                value={apiKey}
                onBlur={handleSubmit}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="请输入 API Key"
              />
              <button
                type="button"
                onClick={() => setShowApiKey(!showApiKey)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-theme-gray3 hover:text-theme-white cursor-pointer"
              >
                <FontAwesomeIcon
                  icon={showApiKey ? faEye : faEyeSlash}
                  className='text-theme-gray4 hover:text-theme-green'
                />
              </button>
            </div>
          </div>
          <div className="mx-auto my-2.5 w-[95%]">
            <div className="text-theme-white text-sm mb-1">Base URL</div>
            <input
              type='text'
              className="border-0 h-[25px] bg-theme-gray2 w-full p-3"
              value={baseUrl}
              onBlur={handleSubmit}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="请输入 Base URL"
            />
          </div>
        </>
      )}
      <div className="overflow-y-auto flex-1 p-1.25">
        {modelError ? (
          <div className="p-2.5 rounded-small m-2.5 bg-theme-black text-theme-green">
            {modelError}
          </div>
        ) : (
          <>
            {Object.keys(favoriteModels.chat).length > 0 && (
              <div className="m-2.5">
                <div className="text-theme-green font-bold mb-2">对话模型</div>
                {Object.keys(favoriteModels.chat).map((modelId, index) => (
                  <div
                    key={`chat-${index}`}
                    className={`m-2.5 cursor-pointer flex items-center`}
                  >
                    <div className="flex-1">{modelId}</div>
                    <div className="flex-1">上下文: {favoriteModels.chat[modelId]}</div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteModel(modelId, 'chat');
                      }}
                      className="ml-2 px-2 py-1 bg-theme-gray3 text-theme-white text-xs rounded hover:bg-theme-green"
                    >
                      <FontAwesomeIcon icon={faMinus} />
                    </button>
                  </div>
                ))}
              </div>
            )}
            {Object.keys(favoriteModels.embedding).length > 0 && (
              <div className="m-2.5">
                <div className="text-theme-green font-bold mb-2">嵌入模型</div>
                {Object.keys(favoriteModels.embedding).map((modelId, index) => {
                  const modelInfo = favoriteModels.embedding[modelId];
                  return (
                    <div
                      key={`embedding-${index}`}
                      className={`m-2.5 cursor-pointer flex items-center`}
                    >
                      <div className="flex-1">{modelId}</div>
                      <div className="flex-1">维度: {modelInfo.dimensions}</div>
                      <div className="flex-1">最大Token: {modelInfo['max-tokens'] || '-'}</div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteModel(modelId, 'embedding');
                      }}
                      className="ml-2 px-2 py-1 bg-theme-gray3 text-theme-white text-xs rounded hover:bg-theme-green"
                    >
                      <FontAwesomeIcon icon={faMinus} />
                    </button>
                    </div>
                  );
                })}
              </div>
            )}
            {Object.keys(favoriteModels.other).length > 0 && (
              <div className="m-2.5">
                <div className="text-theme-green font-bold mb-2">其他模型</div>
                {Object.keys(favoriteModels.other).map((modelId, index) => (
                  <div
                    key={`other-${index}`}
                    className={`m-2.5 cursor-pointer flex items-center`}
                  >
                    <div className="flex-1">{modelId}</div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteModel(modelId, 'other');
                      }}
                      className="ml-2 px-2 py-1 bg-theme-gray3 text-theme-white text-xs rounded hover:bg-theme-green"
                    >
                      <FontAwesomeIcon icon={faMinus} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
      {selectedProviderId && (
        <div className="p-2.5">
          <button
            onClick={() => setShowAddModelModal(true)}
            className="w-full bg-theme-green text-theme-white py-2.5 rounded-small hover:opacity-90"
          >
            添加模型
          </button>
        </div>
      )}
      <AddModelModal
        isOpen={showAddModelModal}
        onClose={() => setShowAddModelModal(false)}
        selectedProviderId={selectedProviderId}
      />
    </Panel>
  );
};

export default ModelListPanel;
