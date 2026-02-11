import { useState, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import type { RootState } from "../../../store/store";
import { setKnowledgeBases } from "../../../store/knowledge";
import UnifiedModal from "../../others/UnifiedModal";
import httpClient from "../../../utils/httpClient";
import {
  validateChunkSize,
  validateOverlapSize,
  validateSimilarity,
  validateReturnDocs,
  convertSimilarityForBackend,
} from "../../../utils/validationUtils";

interface AddKnowledgeBaseModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const AddKnowledgeBaseModal = ({ isOpen, onClose }: AddKnowledgeBaseModalProps) => {
  const dispatch = useDispatch();
  const providerData = useSelector(
    (state: RootState) => state.providerSlice.allProvidersData,
  );

  const [errorMessage, setErrorMessage] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    embeddingModel: '',
    chunkSize: '150',
    overlapSize: '20',
    similarity: '0',
    returnDocs: '10',
  });

  const getEnabledProviders = () => {
    const result: {
      [key: string]: {
        name: string;
        embedding: { [key: string]: any };
      };
    } = {};
    for (const [id, provider] of Object.entries(providerData)) {
      if (provider.enable) {
        result[id] = {
          name: provider.name,
          embedding: provider.favoriteModels.embedding,
        };
      }
    }
    return result;
  };

  const enableProvider = getEnabledProviders();

  // 当弹窗打开时，自动选择第一个可用的嵌入模型
  useEffect(() => {
    if (isOpen) {
      const options = getAllEmbeddingModelOptions();
      if (options.length > 0 && !formData.embeddingModel && options[0]) {
        setFormData({ ...formData, embeddingModel: options[0].value });
      }
    }
  }, [isOpen]);

  const getAllEmbeddingModelOptions = () => {
    const options: { label: string; value: string }[] = [];
    for (const [providerId, provider] of Object.entries(enableProvider)) {
      for (const [model, values] of Object.entries(provider.embedding)) {
        options.push({
          label: `${provider.name}/${model}: ${values.dimensions}`,
          value: `${providerId}|${model}`
        });
      }
    }
    return options;
  };

  if (!isOpen) return null;

  return (
    <>
    <UnifiedModal
      title="添加知识库"
      inputs={[
        {
          label: "名称",
          type: "text",
          value: formData.name,
          onChange: (value) => setFormData({ ...formData, name: value }),
          placeholder: "请输入知识库名称",
          required: true,
        },
        {
          label: "嵌入模型",
          type: "select",
          value: formData.embeddingModel,
          onChange: (value) => setFormData({ ...formData, embeddingModel: value }),
          options: getAllEmbeddingModelOptions(),
          required: true,
        },
        {
          label: "分段大小",
          type: "text",
          value: formData.chunkSize,
          onChange: (value) => setFormData({ ...formData, chunkSize: validateChunkSize(value) }),
          placeholder: "请输入分段大小(0-1000)",
          required: true,
        },
        {
          label: "重叠大小",
          type: "text",
          value: formData.overlapSize,
          onChange: (value) => setFormData({ ...formData, overlapSize: validateOverlapSize(value, formData.chunkSize) }),
          placeholder: "请输入重叠大小(小于分段大小)",
          required: true,
        },
        {
          label: "相似度",
          type: "text",
          value: formData.similarity,
          onChange: (value) => setFormData({ ...formData, similarity: validateSimilarity(value) }),
          placeholder: "请输入相似度(0-9)",
          required: true,
        },
        {
          label: "返回文档片段数",
          type: "text",
          value: formData.returnDocs,
          onChange: (value) => setFormData({ ...formData, returnDocs: validateReturnDocs(value) }),
          placeholder: "请输入返回文档片段数(0-50)",
          required: true,
        },
      ]}
      buttons={[
        {
          text: "取消",
          onClick: () => {
            setFormData({
              name: '',
              embeddingModel: '',
              chunkSize: '150',
              overlapSize: '20',
              similarity: '0',
              returnDocs: '10',
            });
            onClose();
          },
          className: "bg-theme-gray3",
        },
        {
          text: "确认",
          onClick: async () => {
            try {
              if (!formData.name.trim()) {
                setErrorMessage('请输入知识库名称');
                return;
              }

              const chunkSize = parseInt(formData.chunkSize);
              const overlapSize = parseInt(formData.overlapSize);
              const similarity = convertSimilarityForBackend(formData.similarity);
              const returnDocs = parseInt(formData.returnDocs);

              const id = `db_${Date.now()}`;
              const [providerId, modelName] = formData.embeddingModel.split('|');
              const dimensions = parseInt(enableProvider[providerId as string]?.embedding[modelName as string]?.dimensions || '0');
              
              const requestData = {
                id,
                name: formData.name,
                provider: providerId,
                model: modelName,
                dimensions,
                chunkSize,
                overlapSize,
                similarity,
                returnDocs
              };
              
              console.log('提交的数据:', requestData);
              
              const result = await httpClient.post('/api/knowledge/bases', requestData);
              if (result) {
                dispatch(setKnowledgeBases(result));
                setFormData({
                  name: '',
                  embeddingModel: '',
                  chunkSize: '150',
                  overlapSize: '20',
                  similarity: '0',
                  returnDocs: '10',
                });
                onClose();
              }
            } catch (error) {
              setErrorMessage(`添加失败: ${(error as Error).message}`);
            }
          },
          className: "bg-theme-green",
        },
      ]}
    />
    {errorMessage && (
      <UnifiedModal
        title="提示"
        message={errorMessage}
        buttons={[
          {
            text: "确定",
            onClick: () => setErrorMessage(''),
            className: "bg-theme-green",
          },
        ]}
      />
    )}
    </>
  );
};

export default AddKnowledgeBaseModal;
