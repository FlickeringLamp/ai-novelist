import { useRef, useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faAngleRight, faAngleUp } from '@fortawesome/free-solid-svg-icons';
import type { RootState } from '../../store/store';
import type { Message, AIMessage } from '../../types/langchain';
import { setAvailableTools } from '../../store/mode';
import { selectMessages } from '../../store/chat';
import httpClient from '../../utils/httpClient';

const MessageDisplayPanel = () => {
  const dispatch = useDispatch();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [expandedTools, setExpandedTools] = useState<Set<string>>(new Set());
  const [expandedToolResults, setExpandedToolResults] = useState<Set<string>>(new Set());
  
  // 从Redux获取可用工具信息
  const availableTools = useSelector((state: RootState) => state.modeSlice.availableTools);
  
  // 从Redux获取消息列表
  const messages = useSelector((state: RootState) => selectMessages(state));

  // 加载可用工具数据
  useEffect(() => {
    const loadTools = async () => {
      try {
        const toolsResult = await httpClient.get('/api/mode/tool/available-tools');
        if (toolsResult) {
          dispatch(setAvailableTools(toolsResult));
        }
      } catch (error) {
        console.error('加载工具数据失败:', error);
      }
    };
    loadTools();
  }, []);


  // 自动滚动到最新消息
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // 切换工具展开/折叠状态
  const toggleToolExpand = (msgId: string, toolIndex: number) => {
    const key = `${msgId}-${toolIndex}`;
    setExpandedTools(prev => {
      const newSet = new Set(prev);
      if (newSet.has(key)) {
        newSet.delete(key);
      } else {
        newSet.add(key);
      }
      return newSet;
    });
  };

  // 切换工具结果展开/折叠状态
  const toggleToolResultExpand = (msgId: string) => {
    setExpandedToolResults(prev => {
      const newSet = new Set(prev);
      if (newSet.has(msgId)) {
        newSet.delete(msgId);
      } else {
        newSet.add(msgId);
      }
      return newSet;
    });
  };

  // 获取预览内容（第一行或前几个字）
  const getPreviewContent = (content: string): string => {
    const lines = content.split('\n');
    const firstLine = lines[0]?.trim() || '';
    if (firstLine.length > 50) {
      return firstLine.substring(0, 50) + '...';
    }
    return firstLine || '...';
  };

  // 当消息列表变化时自动滚动到底部
  const scrollRef = useRef(messages.length);
  if (messages.length !== scrollRef.current) {
    scrollRef.current = messages.length;
    setTimeout(scrollToBottom, 0);
  }

  // 渲染消息
  const renderMessage = (msg: Message) => {
    const isUser = msg.type === 'human';
    const isToolResult = msg.type === 'tool';
    
    // 工具结果消息独立渲染
    if (isToolResult) {
      const isExpanded = expandedToolResults.has(msg.id);
      const previewContent = getPreviewContent(msg.content || '');
      
      return (
        <div
          key={msg.id}
          className="flex flex-col max-w-[80%] self-start bg-theme-gray1 border border-theme-green p-2.5 rounded-medium break-words overflow-wrap break-word"
        >
          <div className="flex items-center justify-between cursor-pointer" onClick={() => toggleToolResultExpand(msg.id)}>
            <div className="flex items-center">
              <FontAwesomeIcon icon={isExpanded ? faAngleUp : faAngleRight} className="text-theme-green hover:text-theme-white text-xs mr-2" />
              <span className="font-bold text-[0.9em] text-theme-white">工具</span>
            </div>
          </div>
          <div className="leading-[1.4] overflow-wrap break-word break-words text-theme-white mt-1">
            {isExpanded ? (
              <div className="whitespace-pre-wrap">{msg.content}</div>
            ) : (
              <div className="text-theme-gray3 text-sm">{previewContent}</div>
            )}
          </div>
        </div>
      );
    }
    
    // 用户消息、AI消息
    return (
      <div
        key={msg.id}
        className={`flex flex-col max-w-[80%] p-2.5 rounded-medium break-words overflow-wrap break-word ${
          isUser
            ? 'self-end bg-theme-green1 text-theme-white'
            : 'self-start bg-theme-gray2 text-theme-white'
        }`}
      >
        <div className="font-bold mb-1 text-[0.9em]">
          {isUser ? '用户' : 'AI'}
        </div>
        <div className="leading-[1.4] overflow-wrap break-word break-words">
          {isUser ? (
            <div className="whitespace-pre-wrap">{msg.content}</div>
          ) : (
            <div>
              <div className="whitespace-pre-wrap">{msg.content}</div>
              {msg.type === 'ai' && (msg as AIMessage).tool_calls && (msg as AIMessage).tool_calls.length > 0 && (
                <div className="mt-2 p-2 bg-black/20 rounded-small">
                  {(msg as AIMessage).tool_calls.map((toolCall, toolIndex) => {
                    const toolKey = `${msg.id}-${toolIndex}`;
                    const isExpanded = expandedTools.has(toolKey);
                    const args = toolCall.args;
                    const path = args && typeof args === 'object' && 'path' in args ? (args as any).path : null;
                    
                    return (
                      <div key={toolIndex} className="mb-1.5 p-1 bg-black/10 rounded-small">
                        <div className="flex items-center gap-2">
                          <FontAwesomeIcon
                            icon={isExpanded ? faAngleUp : faAngleRight}
                            className="text-xs text-theme-green cursor-pointer hover:text-theme-white"
                            onClick={() => toggleToolExpand(msg.id, toolIndex)}
                          />
                          <span className="font-bold text-theme-green">
                            {availableTools[toolCall.name || '']?.name || toolCall.name || '未知工具'}
                          </span>
                          {path && (
                            <span className="text-xs text-theme-gray3">
                              {path}
                            </span>
                          )}
                        </div>
                        {isExpanded && args && (
                          <div className="mt-1 text-[0.8em] text-theme-white whitespace-pre-wrap break-words">
                            {(() => {
                              const parsedArgs = typeof args === 'string' ? JSON.parse(args) : args;
                              
                              return (args as any)._loading
                                ? `加载中... ${(args as any)._partial_args || ''}`
                                : (() => {
                                    const content = parsedArgs.content;
                                    if (content !== undefined) {
                                      return content;
                                    }
                                    // 如果没有content，显示所有键值对，但排除content键（如果存在）
                                    const result: Record<string, any> = {};
                                    for (const [key, value] of Object.entries(parsedArgs)) {
                                      if (key !== 'content') {
                                        result[key] = value;
                                      }
                                    }
                                    return JSON.stringify(result, null, 2);
                                  })();
                            })()}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
              {msg.type === 'ai' && (msg as AIMessage).usage_metadata && (
                <div className="mt-2 text-[0.75em] text-theme-gray3">
                  输入: {(msg as AIMessage).usage_metadata?.input_tokens || 0} / 输出: {(msg as AIMessage).usage_metadata?.output_tokens || 0}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="flex-1 overflow-y-auto p-2.5 flex flex-col">
      <div className="flex-1 overflow-y-auto mt-2.5 flex flex-col gap-2">
        {messages.length === 0 ? (
          <div className="text-center text-theme-gray2 text-sm">暂无消息</div>
        ) : (
          messages.map(renderMessage)
        )}
        <div ref={messagesEndRef} />
      </div>
    </div>
  );
};

export default MessageDisplayPanel;
