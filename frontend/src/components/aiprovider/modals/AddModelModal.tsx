import { useState, useEffect } from 'react';
import { useDispatch } from 'react-redux';
import type { RootState } from '../../../store/store';
import { setAllProvidersData } from '../../../store/provider';
import UnifiedModal from '../../others/UnifiedModal';
import httpClient from '../../../utils/httpClient';

interface AddModelModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedProviderId: string | null;
}

const AddModelModal = ({ isOpen, onClose, selectedProviderId }: AddModelModalProps) => {
  const dispatch = useDispatch();

  const [modelType, setModelType] = useState('chat');
  const [modelName, setModelName] = useState('');
  const [contextInfo, setContextInfo] = useState('');
  const [embeddingDimension, setEmbeddingDimension] = useState('');
  const [availableModels, setAvailableModels] = useState<string[]>([]);

  useEffect(() => {
    if (isOpen && selectedProviderId) {
      fetchAvailableModels();
    }
  }, [isOpen, selectedProviderId]);

  const fetchAvailableModels = async () => {
    if (!selectedProviderId) return;
    try {
      const response = await httpClient.get(`/api/provider/${selectedProviderId}/models`);
      setAvailableModels(response || []);
    } catch (error) {
      console.error('获取模型列表失败:', error);
      setAvailableModels([]);
    }
  };

  const handleAddModelSubmit = async () => {
    if (!selectedProviderId || !modelType || !modelName) {
      return;
    }

    try {
      await httpClient.post('/api/provider/favorite-models/add', {
        modelId: modelName,
        provider: selectedProviderId,
        modelType: modelType,
        context: parseInt(contextInfo) || 32000,
        dimensions: parseInt(embeddingDimension) || 1024
      });

      const providersResult = await httpClient.get('/api/provider/providers');
      dispatch(setAllProvidersData(providersResult));

      onClose();
      setModelName('');
      setContextInfo('');
      setEmbeddingDimension('');
    } catch (error) {
      console.error('添加模型失败:', error);
    }
  };

  const handleCancelAddModel = () => {
    onClose();
    setModelName('');
    setContextInfo('');
    setEmbeddingDimension('');
    setAvailableModels([]);
  };

  const handleModelNameChange = (value: string) => {
    setModelName(value);
  };

  const handleSelectModel = (modelId: string) => {
    setModelName(modelId);
  };

  if (!isOpen) return null;

  return (
    <UnifiedModal
      title="添加模型"
      inputs={[
        {
          label: '类型:',
          type: 'select',
          value: modelType,
          onChange: setModelType,
          options: ['chat', 'embedding', 'other'],
          required: true
        },
        {
          label: '模型id:',
          type: 'text',
          value: modelName,
          onChange: handleModelNameChange,
          placeholder: '请输入模型id',
          required: true,
          autocompleteOptions: availableModels,
          onAutocompleteSelect: handleSelectModel
        },
        {
          label: '上下文长度:',
          type: 'text',
          value: contextInfo,
          onChange: setContextInfo,
          placeholder: '请输入上下文长度，如128000',
          required: true
        },
        ...(modelType === 'embedding' ? [{
          label: '嵌入维度:',
          type: 'text' as const,
          value: embeddingDimension,
          onChange: setEmbeddingDimension,
          placeholder: '请输入嵌入维度',
          required: true
        }] : [])
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
  );
};

export default AddModelModal;
