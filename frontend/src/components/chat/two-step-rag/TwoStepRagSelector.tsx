import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faAngleRight, faAngleUp } from '@fortawesome/free-solid-svg-icons';
import type { RootState } from '../../../store/store';
import { setKnowledgeBases } from '../../../store/knowledge';
import { setTwoStepRagConfig, setTwoStepRagExpanded } from '../../../store/chat';
import httpClient from '../../../utils/httpClient';

const TwoStepRagSelector = () => {
  const dispatch = useDispatch();
  const selectedRag = useSelector((state: RootState) => state.chatSlice.twoStepRagConfig);
  const expanded = useSelector((state: RootState) => state.chatSlice.twoStepRagExpanded);

  // 加载两步RAG配置和知识库数据
  useEffect(() => {
    const loadTwoStepRagConfig = async () => {
      try {
        // 加载两步RAG配置
        const ragConfig = await httpClient.get('/api/knowledge/two-step-rag');
        dispatch(setTwoStepRagConfig(ragConfig));
      } catch (error) {
        console.error('加载两步RAG配置失败:', error);
      }
    };

    const loadKnowledgeBases = async () => {
      try {
        const bases = await httpClient.get('/api/knowledge/bases');
        dispatch(setKnowledgeBases(bases));
      } catch (error) {
        console.error('加载知识库列表失败:', error);
      }
    };

    loadTwoStepRagConfig();
    loadKnowledgeBases();
  }, [dispatch]);

  // 切换展开状态
  const handleToggleExpanded = () => {
    dispatch(setTwoStepRagExpanded(!expanded));
  };

  // 获取当前显示的名称
  const displayName = selectedRag.name || '未选择知识库';

  return (
    <div className="relative flex flex-1 z-[100] box-border">
      <div
        className="flex items-center justify-center w-full p-2 bg-theme-black border border-theme-gray1 rounded-small cursor-pointer transition-all min-h-[36px] box-border hover:border-theme-green hover:bg-theme-gray1 gap-1"
        onClick={handleToggleExpanded}
      >
        <FontAwesomeIcon icon={expanded ? faAngleUp : faAngleRight} className="text-theme-white text-[12px]" />
        <span className="text-theme-white text-[14px] font-medium whitespace-nowrap overflow-hidden text-ellipsis">{displayName}</span>
      </div>
    </div>
  );
};

export default TwoStepRagSelector;
