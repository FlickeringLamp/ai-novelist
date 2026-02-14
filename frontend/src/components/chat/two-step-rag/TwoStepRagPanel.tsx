import { useDispatch, useSelector } from 'react-redux';
import type { RootState } from '../../../store/store';
import { setTwoStepRagExpanded, setTwoStepRagConfig } from '../../../store/chat';
import httpClient from '../../../utils/httpClient';

const TwoStepRagPanel = () => {
  const dispatch = useDispatch();
  const expanded = useSelector((state: RootState) => state.chatSlice.twoStepRagExpanded);
  const selectedRag = useSelector((state: RootState) => state.chatSlice.twoStepRagConfig);
  const knowledgeBases = useSelector((state: RootState) => state.knowledgeSlice.knowledgeBases);

  // 切换RAG配置
  const handleSelectRag = async (id: string | null, name: string | null) => {
    try {
      // 先更新后端配置
      await httpClient.put('/api/knowledge/two-step-rag', { id, name });
      // 从后端获取最新配置
      const ragConfig = await httpClient.get('/api/knowledge/two-step-rag');
      dispatch(setTwoStepRagConfig(ragConfig));
      dispatch(setTwoStepRagExpanded(false));
    } catch (error) {
      console.error('设置两步RAG配置失败:', error);
    }
  };

  if (!expanded) return null;

  return (
    <div className="absolute bottom-[60px] left-0 right-0 bg-theme-black border border-theme-gray1 rounded-small shadow-lg max-h-[300px] overflow-y-auto z-[101]">
      {/* 清除选项 */}
      <div 
        className="flex items-center p-2 hover:bg-theme-gray1 cursor-pointer border-b border-theme-gray1"
        onClick={() => handleSelectRag(null, null)}
      >
        <span className="text-theme-white text-[14px]">清空配置</span>
      </div>
      
      {/* 知识库列表 */}
      {Object.entries(knowledgeBases).map(([id, base]) => (
        <div 
          key={id}
          className={`flex items-center p-2 hover:bg-theme-gray1 cursor-pointer ${selectedRag.id === id ? 'bg-theme-gray1' : ''}`}
          onClick={() => handleSelectRag(id, base.name)}
        >
          <span className="text-theme-white text-[14px]">{base.name}</span>
        </div>
      ))}
    </div>
  );
};

export default TwoStepRagPanel;
