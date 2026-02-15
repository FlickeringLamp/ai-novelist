import { useDispatch } from 'react-redux';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFileLines, faPlus } from '@fortawesome/free-solid-svg-icons';
import ModeSelectorPanel from './ModeSelectorPanel';
import AutoApprovePanel from './AutoApprovePanel';
import ModelSelectorPanel from './ModelSelectorPanel';
import TwoStepRagSelector from './two-step-rag/TwoStepRagSelector';
import TwoStepRagPanel from './two-step-rag/TwoStepRagPanel';
import ContextProgressBar from './ContextProgressBar';
import MessageInputPanel from './MessageInputPanel';
import MiddlePart from './MiddlePart';
import { clearChat, setSelectedThreadId } from '../../store/chat';

const ChatPanel = () => {
  const dispatch = useDispatch();

  // 创建新会话
  const handleNewThread = () => {
    dispatch(setSelectedThreadId(null));
    console.log("回到初始状态");
  };
  return (
    <div className="flex flex-col h-full relative">
      {/* 顶部区域 */}
      <div className="h-[5%] w-full flex justify-center items-center p-1 border-b border-theme-gray3 gap-5">
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
          onClick={handleNewThread}
        >
          <FontAwesomeIcon icon={faPlus} />
        </button>
      </div>

      {/* 上下文进度条 */}
      <ContextProgressBar />

      {/* 中间部分 - 消息显示区域/历史消息栏 */}
      <MiddlePart />

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
