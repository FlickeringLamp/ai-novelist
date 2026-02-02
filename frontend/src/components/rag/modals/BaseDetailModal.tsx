import { useState, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import type { RootState } from "../../../store/store";
import { setKnowledgeBases } from "../../../store/knowledge";
import httpClient from "../../../utils/httpClient";

interface BaseDetailModalProps {
  isOpen: boolean;
  knowledgeBaseId: string | null;
  onClose: () => void;
}

const BaseDetailModal = ({ isOpen, knowledgeBaseId, onClose }: BaseDetailModalProps) => {
  const dispatch = useDispatch();
  const { knowledgeBases } = useSelector(
    (state: RootState) => state.knowledgeSlice
  );

  const providerData = useSelector(
    (state: RootState) => state.providerSlice.allProvidersData,
  );

  const [formData, setFormData] = useState({
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

  useEffect(() => {
    if (isOpen && knowledgeBaseId) {
      const kb = knowledgeBases[knowledgeBaseId];
      if (kb) {
        setFormData({
          chunkSize: kb.chunkSize.toString(),
          overlapSize: kb.overlapSize.toString(),
          similarity: kb.similarity.toString(),
          returnDocs: kb.returnDocs.toString(),
        });
      }
    }
  }, [isOpen, knowledgeBaseId, knowledgeBases]);

  const handleFieldUpdate = async (field: string, value: string) => {
    try {
      if (!knowledgeBaseId) return;
      const kb = knowledgeBases[knowledgeBaseId];
      if (!kb) return;

      let parsedValue: number;
      
      if (field === 'similarity') {
        parsedValue = parseFloat(value);
      } else {
        parsedValue = parseInt(value);
      }

      if (isNaN(parsedValue)) {
        alert('请输入有效的数字');
        return;
      }

      await httpClient.put(`/api/knowledge/bases/${knowledgeBaseId}`, {
        [field]: parsedValue
      });

      const updatedKb = await httpClient.get('/api/knowledge/bases');
      if (updatedKb) {
        dispatch(setKnowledgeBases(updatedKb));
      }
    } catch (error) {
      alert(`更新失败: ${(error as Error).message}`);
    }
  };

  if (!isOpen || !knowledgeBaseId) return null;

  return (
    <div className="fixed top-0 left-0 right-0 bottom-0 flex justify-center items-center z-[1000]">
      <div className="bg-theme-gray1 rounded-medium shadow-medium px-5 py-3.75 max-w-[500px] w-[400px] text-theme-white">
        <h3 className="m-0 text-theme-white text-lg mb-3.75">知识库详细信息</h3>
        <div className="space-y-4">
          <div className="p-4 rounded">
            <div className="text-sm">嵌入维度</div>
            <div className="text-lg font-medium">
              {enableProvider[knowledgeBases[knowledgeBaseId!]!.provider]?.embedding?.[knowledgeBases[knowledgeBaseId!]!.model]?.dimensions || '-'}
            </div>
          </div>
          <div className="p-4 rounded">
            <div className="text-sm">嵌入模型</div>
            <div className="text-lg font-medium">
              {enableProvider[knowledgeBases[knowledgeBaseId!]!.provider]?.name}/{knowledgeBases[knowledgeBaseId]?.model}
            </div>
          </div>
          <div className="p-4 rounded">
            <div className="text-sm">切分大小</div>
            <input
              type="number"
              value={formData.chunkSize}
              onChange={(e) => setFormData({ ...formData, chunkSize: e.target.value })}
              onBlur={(e) => handleFieldUpdate('chunkSize', e.target.value)}
              className="text-lg font-medium w-full bg-transparent border-b border-theme-gray3 focus:border-theme-green outline-none"
            />
          </div>
          <div className="p-4 rounded">
            <div className="text-sm">重叠大小</div>
            <input
              type="number"
              value={formData.overlapSize}
              onChange={(e) => setFormData({ ...formData, overlapSize: e.target.value })}
              onBlur={(e) => handleFieldUpdate('overlapSize', e.target.value)}
              className="text-lg font-medium w-full bg-transparent border-b border-theme-gray3 focus:border-theme-green outline-none"
            />
          </div>
          <div className="p-4 rounded">
            <div className="text-sm">相似度阈值</div>
            <input
              type="number"
              step="0.1"
              value={formData.similarity}
              onChange={(e) => setFormData({ ...formData, similarity: e.target.value })}
              onBlur={(e) => handleFieldUpdate('similarity', e.target.value)}
              className="text-lg font-medium w-full bg-transparent border-b border-theme-gray3 focus:border-theme-green outline-none"
            />
          </div>
          <div className="p-4 rounded">
            <div className="text-sm">返回文档片段数</div>
            <input
              type="number"
              value={formData.returnDocs}
              onChange={(e) => setFormData({ ...formData, returnDocs: e.target.value })}
              onBlur={(e) => handleFieldUpdate('returnDocs', e.target.value)}
              className="text-lg font-medium w-full bg-transparent border-b border-theme-gray3 focus:border-theme-green outline-none"
            />
          </div>
        </div>
        <div className="mt-3.75 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded bg-theme-gray3 hover:bg-theme-gray2"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  );
};

export default BaseDetailModal;
