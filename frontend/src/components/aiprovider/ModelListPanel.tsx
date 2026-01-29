import { useState } from 'react';
import { Panel } from 'react-resizable-panels';
import UnifiedModal from '../others/UnifiedModal';

interface ModelListPanelProps {
  selectedProviderId: string | null;
  apiKey: string;
  baseUrl: string;
  favoriteModels: {chat: {[key: string]: any}, embedding: {[key: string]: any}, other: {[key: string]: any}};
  selectedModelId: string | null;
  modelError: string;
  onApiKeyChange: (value: string) => void;
  onBaseUrlChange: (value: string) => void;
  onConfigSubmit: () => void;
  onModelClick: (modelId: string) => void;
}

const ModelListPanel = ({
  selectedProviderId,
  apiKey,
  baseUrl,
  favoriteModels,
  selectedModelId,
  modelError,
  onApiKeyChange,
  onBaseUrlChange,
  onConfigSubmit,
  onModelClick
}: ModelListPanelProps) => {
  const [showAddModelModal, setShowAddModelModal] = useState(false);
  const [modelType, setModelType] = useState('');
  const [modelName, setModelName] = useState('');
  const [contextInfo, setContextInfo] = useState('');
  const [embeddingDimension, setEmbeddingDimension] = useState('');

  const handleAddModelSubmit = () => {
    console.log('添加模型:', {
      type: modelType,
      name: modelName,
      context: contextInfo,
      dimension: embeddingDimension || '-'
    });
    setShowAddModelModal(false);
    setModelType('');
    setModelName('');
    setContextInfo('');
    setEmbeddingDimension('');
  };

  const handleCancelAddModel = () => {
    setShowAddModelModal(false);
    setModelType('');
    setModelName('');
    setContextInfo('');
    setEmbeddingDimension('');
  };

  return (
    <Panel className='border border-theme-gray1 flex flex-col h-[932px]'>
      {selectedProviderId && (
        <div className='block mx-auto my-5 bg-theme-gray1 p-2.5 rounded-small w-[80%]'>
          <label htmlFor="api-input" className="block mx-auto my-2.5 mb-1.25 text-theme-white w-[80%] text-left">API Key:</label>
          <input
            type='password'
            id='api-input'
            className="block mx-auto my-2.5 border-0 h-[25px] w-[80%] bg-theme-gray1"
            value={apiKey}
            onBlur={onConfigSubmit}
            onChange={(e) => onApiKeyChange(e.target.value)}
            placeholder="请输入 API Key"
          />
          <label htmlFor="url-input" className="block mx-auto my-2.5 mb-1.25 text-theme-white w-[80%] text-left">Base URL:</label>
          <input
            type='text'
            id='url-input'
            className="block mx-auto my-2.5 border-0 h-[25px] w-[80%] bg-theme-gray1"
            value={baseUrl}
            onBlur={onConfigSubmit}
            onChange={(e) => onBaseUrlChange(e.target.value)}
            placeholder="请输入 Base URL"
          />
        </div>
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
                    className={`m-2.5 cursor-pointer flex ${selectedModelId === modelId?'border border-theme-green text-theme-green': ''}`}
                    onClick={() => onModelClick(modelId)}
                  >
                    <div className="flex-1">{modelId}</div>
                    <div className="flex-1">上下文: {favoriteModels.chat[modelId]}</div>
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
                      className={`m-2.5 cursor-pointer flex ${selectedModelId === modelId?'border border-theme-green text-theme-green': ''}`}
                      onClick={() => onModelClick(modelId)}
                    >
                      <div className="flex-1">{modelId}</div>
                      <div className="flex-1">维度: {modelInfo.dimensions}</div>
                      <div className="flex-1">最大Token: {modelInfo['max-tokens'] || '-'}</div>
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
                    className={`m-2.5 cursor-pointer ${selectedModelId === modelId?'border border-theme-green text-theme-green': ''}`}
                    onClick={() => onModelClick(modelId)}
                  >
                    {modelId}
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
      {showAddModelModal && (
        <UnifiedModal
          title="添加模型"
          inputs={[
            {
              label: '类型:',
              type: 'text',
              value: modelType,
              onChange: (value) => setModelType(value),
              placeholder: 'chat/embedding/other',
              required: true
            },
            {
              label: '模型id:',
              type: 'text',
              value: modelName,
              onChange: (value) => setModelName(value),
              placeholder: '请输入模型id',
              required: true
            },
            {
              label: '上下文长度:',
              type: 'text',
              value: contextInfo,
              onChange: (value) => setContextInfo(value),
              placeholder: '请输入上下文长度，如128000',
              required: true
            },
            {
              label: '嵌入维度:',
              type: 'text',
              value: embeddingDimension,
              onChange: (value) => setEmbeddingDimension(value),
              placeholder: '请输入嵌入维度（仅嵌入模型）',
              required: false
            }
          ]}
          buttons={[
            {
              text: '确定',
              onClick: handleAddModelSubmit,
              className: 'bg-theme-green'
            },
            {
              text: '取消',
              onClick: handleCancelAddModel,
              className: 'bg-theme-gray3'
            }
          ]}
        />
      )}
    </Panel>
  );
};

export default ModelListPanel;
