import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import type { RootState } from "../../store/store";
import { setAllProvidersData } from "../../store/provider";
import UnifiedModal from "../others/UnifiedModal";
import httpClient from "../../utils/httpClient"

const KnowledgeBasePanel = () => {
  const dispatch = useDispatch();
  const [enableProvider, setEnableProvider] = useState<{
    [key: string]: {
      name: string;
      embedding: { [key: string]: any };
    };
  }>({})
  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState("");
  const [providerId, setProviderId] = useState("");
  const [embeddingModel, setEmbeddingModel] = useState("");
  const [chunkSize, setChunkSize] = useState("");
  const [overlapSize, setOverlapSize] = useState("");
  const [similarity, setSimilarity] = useState("");
  const [returnDocs, setReturnDocs] = useState("");

  // 挂载时从后端获取提供商数据
  useEffect(() => {
    const fetchProviders = async () => {
      const result = await httpClient.get('/api/provider/providers');
      console.log("你好，这是从后端获取result后一点",result)
      if (result) {
        dispatch(setAllProvidersData(result));
      }
    };
    fetchProviders();
  }, []);

  const providerData = useSelector(
    (state: RootState) => state.providerSlice.allProvidersData,
  );
  console.log("providerData",providerData)

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

  useEffect(() => {
    console.log("测试",getEnabledProviders())
    setEnableProvider(getEnabledProviders());
  }, [providerData]);

  const getEnabledProviderOptions = () => {
    console.log("enableProvider", enableProvider)
    return Object.entries(enableProvider).map(([id, provider]) => ({
      label: provider.name,
      value: id
    }));
  };

  const getEmbeddingModelOptions = () => {
    if (!providerId) return [];
    const embeddingModel = enableProvider[providerId];
    return Object.entries(embeddingModel!.embedding).map(([model, values]: [string, any]) => ({
      label: model,
      value: model
    }));
  };

  // 当选择提供商时，清空嵌入模型
  const handleProviderChange = (value: string) => {
    setProviderId(value);
    setEmbeddingModel("");
  };

  return (
    <div className="w-full h-full flex">
      <div className="w-[20%] h-full">
        <button
          onClick={() => setShowModal(true)}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          添加
        </button>
      </div>
      <div className="w-[80%] h-full"></div>
      {showModal && (
        <UnifiedModal
          title="添加知识库"
          inputs={[
            {
              label: "名称",
              type: "text",
              value: name,
              onChange: setName,
              placeholder: "请输入知识库名称",
              required: true,
            },
            {
              label: "模型提供商",
              type: "select",
              value: providerId,
              onChange: handleProviderChange,
              options: getEnabledProviderOptions(),
              required: true,
            },
            {
              label: "嵌入模型名",
              type: "select",
              value: embeddingModel,
              onChange: setEmbeddingModel,
              options: getEmbeddingModelOptions(),
              required: true,
              disabled: !providerId,
            },
            {
              label: "分段大小",
              type: "text",
              value: chunkSize,
              onChange: setChunkSize,
              placeholder: "请输入分段大小",
              required: true,
            },
            {
              label: "重叠大小",
              type: "text",
              value: overlapSize,
              onChange: setOverlapSize,
              placeholder: "请输入重叠大小",
              required: true,
            },
            {
              label: "相似度",
              type: "text",
              value: similarity,
              onChange: setSimilarity,
              placeholder: "请输入相似度",
              required: true,
            },
            {
              label: "返回文档片段数",
              type: "text",
              value: returnDocs,
              onChange: setReturnDocs,
              placeholder: "请输入返回文档片段数",
              required: true,
            },
          ]}
          buttons={[
            {
              text: "取消",
              onClick: () => setShowModal(false),
              className: "bg-gray-600",
            },
            {
              text: "确认",
              onClick: () => setShowModal(false),
              className: "bg-theme-green",
            },
          ]}
        />
      )}
    </div>
  );
};

export default KnowledgeBasePanel;
