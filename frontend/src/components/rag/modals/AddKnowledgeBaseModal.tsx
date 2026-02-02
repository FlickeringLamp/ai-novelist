import { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import type { RootState } from "../../../store/store";
import { setKnowledgeBases } from "../../../store/knowledge";
import UnifiedModal from "../../others/UnifiedModal";
import httpClient from "../../../utils/httpClient";

interface AddKnowledgeBaseModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const AddKnowledgeBaseModal = ({ isOpen, onClose }: AddKnowledgeBaseModalProps) => {
  const dispatch = useDispatch();
  const { knowledgeBases } = useSelector(
    (state: RootState) => state.knowledgeSlice
  );

  const providerData = useSelector(
    (state: RootState) => state.providerSlice.allProvidersData,
  );

  const [formData, setFormData] = useState({
    name: '',
    embeddingModel: '',
    chunkSize: '',
    overlapSize: '',
    similarity: '',
    returnDocs: '',
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

  const handleOpen = () => {
    const allModels = getAllEmbeddingModelOptions();
    if (allModels.length > 0 && allModels[0]) {
      setFormData({ ...formData, embeddingModel: allModels[0].value });
    }
  };

  if (!isOpen) return null;

  return (
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
          onChange: (value) => setFormData({ ...formData, chunkSize: value }),
          placeholder: "请输入分段大小",
          required: true,
        },
        {
          label: "重叠大小",
          type: "text",
          value: formData.overlapSize,
          onChange: (value) => setFormData({ ...formData, overlapSize: value }),
          placeholder: "请输入重叠大小",
          required: true,
        },
        {
          label: "相似度",
          type: "text",
          value: formData.similarity,
          onChange: (value) => setFormData({ ...formData, similarity: value }),
          placeholder: "请输入相似度",
          required: true,
        },
        {
          label: "返回文档片段数",
          type: "text",
          value: formData.returnDocs,
          onChange: (value) => setFormData({ ...formData, returnDocs: value }),
          placeholder: "请输入返回文档片段数",
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
              chunkSize: '',
              overlapSize: '',
              similarity: '',
              returnDocs: '',
            });
            onClose();
          },
          className: "bg-theme-gray3",
        },
        {
          text: "确认",
          onClick: async () => {
            try {
              const id = `db_${Date.now()}`;
              const [providerId, modelName] = formData.embeddingModel.split('|');
              const dimensions = enableProvider[providerId as string]?.embedding[modelName as string]?.dimensions;
              
              const requestData = {
                id,
                name: formData.name,
                provider: providerId,
                model: modelName,
                dimensions,
                chunkSize: parseInt(formData.chunkSize),
                overlapSize: parseInt(formData.overlapSize),
                similarity: parseFloat(formData.similarity),
                returnDocs: parseInt(formData.returnDocs)
              };
              
              const result = await httpClient.post('/api/knowledge/bases', requestData);
              if (result) {
                dispatch(setKnowledgeBases(result));
                setFormData({
                  name: '',
                  embeddingModel: '',
                  chunkSize: '',
                  overlapSize: '',
                  similarity: '',
                  returnDocs: '',
                });
                onClose();
              }
            } catch (error) {
              alert(`添加失败: ${(error as Error).message}`);
            }
          },
          className: "bg-theme-green",
        },
      ]}
    />
  );
};

export default AddKnowledgeBaseModal;
