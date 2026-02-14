import { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFileLines, faPlus, faClock } from '@fortawesome/free-solid-svg-icons';
import ModeSelectorPanel from './ModeSelectorPanel';
import AutoApprovePanel from './AutoApprovePanel';
import ModelSelectorPanel from './ModelSelectorPanel';
import TwoStepRagSelector from './two-step-rag/TwoStepRagSelector';
import TwoStepRagPanel from './two-step-rag/TwoStepRagPanel';
import MessageDisplayPanel from './MessageDisplayPanel';
import ContextProgressBar from './ContextProgressBar';
import MessageInputPanel from './MessageInputPanel';
import ToolRequestPanel from './ToolRequestPanel';
import { setState } from '../../store/chat';
import httpClient from '../../utils/httpClient';

const ChatPanel = () => {
  const dispatch = useDispatch();

  // 初始化时获取初始 state
  useEffect(() => {
    const loadInitialState = async () => {
      try {
        const initialState = await httpClient.get('/api/chat/state');
        if (initialState && initialState.values) {
          initialState.values.messages = initialState.values.messages || [];
        }
        dispatch(setState(initialState));
        console.log("langchain初始state:",initialState)
      } catch (error) {
        console.error('加载初始状态失败:', error);
      }
    };
    loadInitialState();
  }, [dispatch]);
  return (
    <div className="flex flex-col h-full relative">
      {/* 顶部区域 */}
      <div className="h-[5%] w-full flex justify-center items-center p-1 border-b border-theme-gray3 gap-5">
        {/* 聊天历史面板按钮 */}
        <button
          className="flex items-center justify-center w-[2vw] h-[3.5vh] bg-theme-black border-0 rounded-small cursor-pointer transition-all hover:border hover:border-theme-green hover:text-theme-green text-theme-white"
          title="历史会话"
        >
          <FontAwesomeIcon icon={faClock} />
        </button>

        <ModelSelectorPanel />

        {/* 总结对话按钮 */}
        <button
          className="bg-theme-black text-theme-white rounded-small w-[2vw] h-[3.5vh] text-lg font-bold flex items-center justify-center border-0 transition-all hover:border hover:border-theme-green hover:text-theme-green disabled:bg-theme-gray1 disabled:cursor-not-allowed disabled:opacity-60"
          title="总结对话"
        >
          <FontAwesomeIcon icon={faFileLines} />
        </button>

        {/* 创建新会话按钮 */}
        <button
          className="bg-theme-black text-theme-white rounded-small w-[2vw] h-[3.5vh] text-lg font-bold flex items-center justify-center border-0 transition-all hover:border hover:border-theme-green hover:text-theme-green"
          title="创建新会话"
        >
          <FontAwesomeIcon icon={faPlus} />
        </button>
      </div>
      
      {/* 上下文进度条 */}
      <ContextProgressBar />
      
      {/* 消息显示区域 */}
      <MessageDisplayPanel />

      {/* 工具请求栏 */}
      <ToolRequestPanel />

      {/* 输入区域 */}
      <MessageInputPanel />

      {/* 底部工具栏 */}
      <div className="w-full flex p-2.5 border-t border-theme-gray1 relative gap-2">
        <ModeSelectorPanel />
        <TwoStepRagSelector />
        <AutoApprovePanel />
      </div>

      {/* 两步RAG面板 */}
      <TwoStepRagPanel />

    </div>
  );
};

export default ChatPanel;
