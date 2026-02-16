import { useDispatch, useSelector } from 'react-redux';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFileLines, faPlus } from '@fortawesome/free-solid-svg-icons';
import ModeSelectorPanel from './mode-selector/ModeSelector';
import ModePanel from './mode-selector/ModePanel';
import AutoApprovePanel from './auto-approve/AutoApproveButton';
import ModelSelectorPanel from './ModelSelectorPanel';
import TwoStepRagSelector from './two-step-rag/TwoStepRagSelector';
import TwoStepRagPanel from './two-step-rag/TwoStepRagPanel';
import ContextProgressBar from './ContextProgressBar';
import MessageInputPanel from './MessageInputPanel';
import MiddlePart from './MiddlePart';
import { setState, setSelectedThreadId } from '../../store/chat';
import type { RootState } from '../../store/store';
import httpClient from '../../utils/httpClient';
import { useState } from 'react';

const ChatPanel = () => {
  const dispatch = useDispatch();
  const summary = useSelector((state: RootState) => state.chatSlice.state?.values.summary || '');
  const selectedThreadId = useSelector((state: RootState) => state.chatSlice.selectedThreadId);
  const [isSummarizing, setIsSummarizing] = useState(false);

  // 创建新会话
  const handleNewThread = () => {
    dispatch(setState(null));
    dispatch(setSelectedThreadId(null));
    console.log("回到初始状态");
  };

  // 总结对话
  const handleSummarize = async () => {
    if (!selectedThreadId) {
      console.error("没有选中的会话");
      return;
    }
    console.log("选中的thread_id是,",selectedThreadId)

    setIsSummarizing(true);
    try {
      const response = await httpClient.streamRequest('/api/history/summarize', {
        method: 'POST',
        body: { thread_id: selectedThreadId }
      });

      if (!response.ok) {
        throw new Error('总结请求失败');
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('无法获取响应流');
      }

      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.trim()) {
            try {
              const message = JSON.parse(line);
              if (message.content) {
                console.log("总结消息：", message.content);
              }
            } catch (e) {
              console.error('解析消息失败:', e);
            }
          }
        }
      }
      
      // 总结完成后，刷新state以获取最新的summary
      const stateData = await httpClient.get('/api/chat/state');
      dispatch(setState(stateData));
    } catch (error) {
      console.error('总结对话失败:', error);
    } finally {
      setIsSummarizing(false);
    }
  };
  return (
    <div className="flex flex-col h-full relative">
      {/* 顶部区域 */}
      <div className="h-[5%] w-full flex justify-center items-center p-1 border-b border-theme-gray3 gap-5">
        <ModelSelectorPanel />

        {/* 总结对话按钮 */}
        <button
          className="bg-theme-black text-theme-white rounded-small w-[2vw] h-[3.5vh] text-lg font-bold flex items-center justify-center border-0 transition-all hover:border hover:border-theme-green hover:text-theme-green disabled:bg-theme-gray1 disabled:cursor-not-allowed disabled:opacity-60"
          title={summary || "总结对话"}
          onClick={handleSummarize}
          disabled={isSummarizing || !selectedThreadId}
        >
          {isSummarizing ? (
            <div className="animate-spin rounded-full h-4 w-4 border-2 border-theme-white border-t-transparent"></div>
          ) : (
            <FontAwesomeIcon icon={faFileLines} />
          )}
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

      {/* 模式面板 */}
      <ModePanel />

    </div>
  );
};

export default ChatPanel;
