import { useSelector, useDispatch } from 'react-redux';
import { useEffect, useRef } from 'react';
import type { RootState } from '../../types';
import type { InterruptResponse } from '../../types/langgraph';
import { handleInterruptResponse } from '../../utils/interruptHandler';
import { useFileToolHandler } from '../../utils/fileToolHandler';

const ToolRequestPanel = () => {
  const dispatch = useDispatch();
  const { processFileToolCalls } = useFileToolHandler();
  const emptyInterrupts: any[] = [];
  const interrupts = useSelector((state: RootState) => state.chatSlice.state?.interrupts || emptyInterrupts);
  const interrupt = interrupts.length > 0 ? (interrupts[0] ?? null) : null;
  const message = useSelector((state: RootState) => state.chatSlice.message);
  const autoApproveEnabled = useSelector((state: RootState) => state.chatSlice.autoApproveEnabled);
  const currentData = useSelector((state: RootState) => state.tabSlice.currentData);
  const aiSuggestContent = useSelector((state: RootState) => state.tabSlice.aiSuggestContent);
  const autoApproveRef = useRef(false);

  // 处理中断响应
  const handleInterrupt = async (response: InterruptResponse) => {
    await handleInterruptResponse(dispatch, interrupt, response, processFileToolCalls, currentData, aiSuggestContent);
  };

  // 自动批准逻辑
  useEffect(() => {
    if (autoApproveEnabled && interrupt && !autoApproveRef.current) {
      autoApproveRef.current = true;
      const timer = setTimeout(() => {
        handleInterrupt({ action: 'approve', choice: '1', additionalData: message || '' });
        autoApproveRef.current = false;
      }, 1000);
      return () => clearTimeout(timer);
    } else if (!interrupt) {
      autoApproveRef.current = false;
    }
  }, [interrupt, autoApproveEnabled, message]);

  // 没有中断时不显示（必须在所有 hooks 之后）
  if (!interrupt) {
    return null;
  }

  return (
    <div className="w-full bg-theme-gray1">
      {/* 操作按钮 */}
      <div className="flex gap-4">
        <button
          className="flex-1 text-theme-white border-none rounded-small py-2 px-4 text-[13px] font-medium cursor-pointer transition-all hover:border-1 hover:border-solid hover:border-theme-green hover:text-theme-green"
          onClick={() => handleInterrupt({ action: 'approve', choice: '1', additionalData: message || '' })}
        >
          确认
        </button>
        <button
          className="flex-1 text-theme-white border-none rounded-small py-2 px-4 text-[13px] font-medium cursor-pointer transition-all hover:border-1 hover:border-solid hover:border-theme-green hover:text-theme-green"
          onClick={() => handleInterrupt({ action: 'reject', choice: '2', additionalData: message || '' })}
        >
          取消
        </button>
      </div>
    </div>
  );
};

export default ToolRequestPanel;
