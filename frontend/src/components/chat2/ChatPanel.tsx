import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFileLines, faPlus, faPaperPlane, faClock, faAngleRight, faAngleUp } from '@fortawesome/free-solid-svg-icons';
import { useState } from 'react';

const ChatPanel = () => {
  const [modeExpanded, setModeExpanded] = useState(false);
  const [autoApproveExpanded, setAutoApproveExpanded] = useState(false);
  return (
    <div className="flex flex-col h-full">
      {/* 顶部区域 */}
      <div className="h-[5%] w-full flex justify-center items-center p-1 border-b border-theme-gray3 gap-5">
        {/* 聊天历史面板按钮 */}
        <button
          className="flex items-center justify-center w-[2vw] h-[3.5vh] bg-theme-black border-0 rounded-small cursor-pointer transition-all hover:border hover:border-theme-green hover:text-theme-green text-theme-white"
          title="历史会话"
        >
          <FontAwesomeIcon icon={faClock} />
        </button>

        {/* 模型选择面板按钮 */}
        <button
          className="flex items-center justify-center gap-2 p-2 w-[40%] bg-theme-black border border-theme-gray3 rounded-[8px] cursor-pointer transition-all min-h-[36px] hover:border-theme-green hover:bg-theme-gray1"
          title="模型选择"
        >
          <span className="text-theme-white text-[14px]">选择模型</span>
        </button>

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
      
      {/* 消息显示区域 */}
      <div className="flex-1 overflow-y-auto p-2.5 flex flex-col">
        <div className="flex-1 overflow-y-auto mt-2.5">
          {/* 消息列表占位 */}
          <div className="flex flex-col gap-2">
            <div className="text-center text-theme-gray2 text-sm">暂无消息</div>
          </div>
        </div>
      </div>

      {/* 输入区域 */}
      <div className="h-[15%] p-2.5 border border-theme-gray3">
        {/* 输入框占位 */}
        <div className="flex w-full flex-1 relative overflow-visible">
          <textarea
            className="bg-theme-black text-theme-white border-none rounded-small resize-none font-inherit text-[14px] box-border flex-1 min-w-0 focus:outline-none"
            placeholder="输入@+空格可选择文件，同时按下shift+回车可换行"
            rows={3}
          />
          <button
            className="bg-transparent text-theme-green border-none cursor-pointer text-[16px] p-0 self-end flex items-center justify-center hover:text-theme-white disabled:text-theme-white disabled:cursor-not-allowed"
          >
            <FontAwesomeIcon icon={faPaperPlane} />
          </button>
        </div>
      </div>
      
      {/* 底部工具栏 */}
      <div className="w-full flex p-2.5 border-t border-theme-gray1 relative gap-10">
        {/* 模式选择器 */}
        <div className="relative flex w-[50%] z-[100] box-border">
          <div className="flex items-center justify-center w-full p-2 bg-theme-black border border-theme-gray1 rounded-small cursor-pointer transition-all min-h-[36px] box-border hover:border-theme-green hover:bg-theme-gray1 gap-1" onClick={() => setModeExpanded(!modeExpanded)}>
            <FontAwesomeIcon icon={modeExpanded ? faAngleUp : faAngleRight} className="text-theme-white text-[12px]" />
            <span className="text-theme-white text-[14px] font-medium whitespace-nowrap overflow-hidden text-ellipsis">细纲模式</span>
          </div>
        </div>

        {/* 自动批准配置 */}
        <div className="relative flex w-[50%] z-[100] box-border">
          <div className="flex items-center justify-center w-full p-2 bg-theme-black border border-theme-gray1 rounded-small cursor-pointer transition-all min-h-[36px] box-border hover:border-theme-green hover:bg-theme-gray1 gap-1" onClick={() => setAutoApproveExpanded(!autoApproveExpanded)}>
            <FontAwesomeIcon icon={autoApproveExpanded ? faAngleUp : faAngleRight} className="text-theme-white text-[12px]" />
            <span className="text-theme-white text-[14px] font-medium whitespace-nowrap overflow-hidden text-ellipsis">自动批准已关闭</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatPanel;
