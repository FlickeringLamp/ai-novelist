import { useState, useEffect } from 'react';
import ReactMarkdownMessageRenderer from './ReactMarkdownMessageRenderer.js';

interface ToolCall {
  name?: string;
  function?: {
    name?: string;
    arguments?: string | Record<string, unknown>;
  };
  args?: Record<string, unknown>;
}

interface Message {
  id?: string;
  role: 'user' | 'assistant' | 'system' | 'tool' | 'tool_request' | 'summary';
  content?: string;
  text?: string;
  tool_calls?: ToolCall[];
}

interface MessageDisplayProps {
  messages: Message[];
  currentAiMessage?: string;
  isLoading?: boolean;
}

const MessageDisplay = ({ messages, currentAiMessage, isLoading }: MessageDisplayProps) => {
  // 为每个工具消息、系统消息和工具请求消息创建折叠状态
  const [collapsedTools, setCollapsedTools] = useState<Record<string, boolean>>({});
  
  // 当消息列表更新时，初始化工具消息、系统消息和工具请求消息的折叠状态
  useEffect(() => {
    const newCollapsedTools = { ...collapsedTools };
    let hasChanges = false;
    
    messages.forEach((msg: Message, index: number) => {
      const messageId = msg.id || `msg_${index}`;
      // 如果是工具消息、系统消息、工具请求消息或总结消息且尚未设置折叠状态，则默认折叠
      if ((msg.role === 'tool' || msg.role === 'system' || msg.role === 'tool_request' || msg.role === 'summary') && (newCollapsedTools as Record<string, boolean>)[messageId] === undefined) {
        // 检查是否是 ask_user 工具请求，如果是则默认展开
        const isAskUserTool = msg.role === 'tool_request' &&
                             msg.tool_calls &&
                             msg.tool_calls.length > 0 &&
                             msg.tool_calls[0]?.name === 'ask_user';
        
        // 总结消息默认折叠，ask_user 工具默认展开，其他默认折叠
        (newCollapsedTools as Record<string, boolean>)[messageId] = msg.role === 'summary' ? true : !isAskUserTool;
        hasChanges = true;
      }
    });
    
    if (hasChanges) {
      setCollapsedTools(newCollapsedTools);
    }
  }, [messages]);
  // 切换工具消息、系统消息、工具请求消息和总结消息的折叠状态
  const toggleToolCollapse = (messageId: string) => {
    setCollapsedTools(prev => ({
      ...prev,
      [messageId]: !(prev as Record<string, boolean>)[messageId]
    }));
  };
  
  return (
    <div className="flex flex-col gap-3 p-2.5 h-full overflow-y-auto">
      {messages.map((msg: Message, index: number) => {
        const isUser = msg.role === 'user';
        const isSystem = msg.role === 'system';
        const isTool = msg.role === 'tool';
        const isSummary = msg.role === 'summary';
        const content = msg.content || msg.text || '';
        const messageId = msg.id || `msg_${index}`;
        const isCollapsed = (isTool || isSystem || msg.role === 'tool_request' || isSummary) && (collapsedTools as Record<string, boolean>)[messageId];
        
        return (
          <div key={messageId} className={`flex flex-col max-w-[80%] p-2.5-[10px] p-2.5-[15px] rounded-medium break-words overflow-wrap break-word ${isUser ? 'self-end bg-theme-green text-theme-white' : isSystem ? 'self-start bg-theme-gray1 text-theme-white border-l-4 border-theme-green' : isTool ? 'self-start bg-theme-gray1 text-theme-white border-l-4 border-theme-green' : msg.role === 'tool_request' ? 'self-start bg-theme-gray1 text-theme-white border-l-4 border-theme-green' : isSummary ? 'self-start bg-theme-gray1 text-theme-white border-l-4 border-theme-green rounded-medium my-2' : 'self-start bg-theme-gray1 text-theme-white'}`}>
            <div className="font-bold mb-1.25 text-[0.9em]">
              {isUser ? '用户' : isSystem ? '系统' : isTool ? '工具' : msg.role === 'tool_request' ? '工具请求' : isSummary ? '📝 对话总结' : 'AI'}
            </div>
            <div className="leading-[1.4] overflow-wrap break-word break-words">
              {isUser ? (
                // 用户消息使用简单文本显示
                <div className="whitespace-pre-wrap">{content}</div>
              ) : isSystem ? (
                // 系统消息使用折叠功能
                <div className="w-full">
                  <div className="flex items-center cursor-pointer p-1 user-select-none hover:bg-white/5 rounded-small" onClick={() => toggleToolCollapse(messageId)}>
                    <span className="mr-2 text-[0.8em] text-theme-green transition-transform">{isCollapsed ? '▶' : '▼'}</span>
                    <span className={`flex-1 text-theme-white whitespace-pre-wrap break-words overflow-wrap break-word break-words overflow-hidden w-full ${isCollapsed ? 'line-clamp-1' : ''}`}>
                      {isCollapsed ? content : content}
                    </span>
                  </div>
                </div>
              ) : isTool ? (
                // 工具消息使用折叠功能
                <div className="w-full">
                  <div className="flex items-center cursor-pointer p-1 user-select-none hover:bg-white/5 rounded-small" onClick={() => toggleToolCollapse(messageId)}>
                    <span className="mr-2 text-[0.8em] text-theme-green transition-transform">{isCollapsed ? '▶' : '▼'}</span>
                    <span className={`flex-1 text-theme-white whitespace-pre-wrap break-words overflow-wrap break-word break-words overflow-hidden w-full ${isCollapsed ? 'line-clamp-1' : ''}`}>
                      {isCollapsed ? content : content}
                    </span>
                  </div>
                  {!isCollapsed && msg.tool_calls && msg.tool_calls.length > 0 && (
                    <div className="mt-2 p-2 bg-black/20 rounded-small">
                      <div className="font-bold mb-1 text-theme-green">调用的工具:</div>
                      {msg.tool_calls.map((toolCall: ToolCall, toolIndex: number) => (
                        <div key={toolIndex} className="mb-1.5 p-1 bg-black/10 rounded-small">
                          <span className="font-bold text-theme-green">{toolCall.name || toolCall.function?.name || '未知工具'}</span>
                          {toolCall.function?.arguments && (
                            <div className="mt-1 text-[0.8em] text-theme-white whitespace-pre-wrap break-words overflow-wrap break-word break-words overflow-hidden w-full">
                              参数: {JSON.stringify(toolCall.function.arguments, null, 2)}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : msg.role === 'tool_request' ? (
                // 工具请求消息使用折叠功能
                <div className="w-full">
                  <div className="flex items-center cursor-pointer p-1 user-select-none hover:bg-white/5 rounded-small" onClick={() => toggleToolCollapse(messageId)}>
                    <span className="mr-2 text-[0.8em] text-theme-green transition-transform">{isCollapsed ? '▶' : '▼'}</span>
                    <span className={`flex-1 text-theme-white whitespace-pre-wrap break-words overflow-wrap break-word break-words overflow-hidden w-full ${isCollapsed ? 'line-clamp-1' : ''}`}>
                      {isCollapsed ? (
                        // 折叠状态下显示工具名称或问题预览
                        (() => {
                          if (msg.tool_calls && msg.tool_calls.length > 0) {
                            const toolCall = msg.tool_calls[0];
                            if (toolCall) {
                              const toolName = toolCall.name || toolCall.function?.name || '未知工具';
                              
                              // 对于 ask_user 工具，尝试显示问题内容
                              if (toolName === 'ask_user') {
                                // 从参数中获取问题内容
                                let question = '询问用户';
                                if (toolCall.args && toolCall.args.question) {
                                  question = toolCall.args.question as string;
                                } else if (toolCall.function && toolCall.function.arguments) {
                                  try {
                                    const args = typeof toolCall.function.arguments === 'string'
                                      ? JSON.parse(toolCall.function.arguments)
                                      : toolCall.function.arguments;
                                    if (args.question) {
                                      question = args.question as string;
                                    }
                                  } catch (e) {
                                    console.error('解析工具参数失败:', e);
                                  }
                                }                            
                                return `询问: ${question.length > 30 ? question.substring(0, 30) + '...' : question}`;
                              }
                              
                              return `工具请求: ${toolName}`;
                            }
                            return '工具请求';
                          }
                        })()
                      ) : (
                          // 展开状态下显示工具请求
                          `工具请求 (${msg.tool_calls?.length || 0}个工具)`
                      )}
                    </span>
                  </div>
                  {!isCollapsed && (
                    <div className="mt-2 p-2 bg-black/20 rounded-small">
                      <div className="font-bold mb-1 text-theme-green">工具请求:</div>
                      {msg.tool_calls?.map((toolCall: ToolCall, toolIndex: number) => (
                        <div key={toolIndex} className="mb-1.5 p-1 bg-black/10 rounded-small">
                          <span className="font-bold text-theme-green">{toolCall.name || toolCall.function?.name || '未知工具'}</span>
                          {toolCall.args && (
                            <div className="mt-1 text-[0.8em] text-theme-white whitespace-pre-wrap break-words overflow-wrap break-word break-words overflow-hidden w-full">
                              参数: {JSON.stringify(toolCall.args, null, 2)}
                            </div>
                          )}
                          {toolCall.function?.arguments && (
                            <div className="mt-1 text-[0.8em] text-theme-white whitespace-pre-wrap break-words overflow-wrap break-word break-words overflow-hidden w-full">
                              参数: {typeof toolCall.function.arguments === 'string'
                                ? JSON.stringify(JSON.parse(toolCall.function.arguments), null, 2)
                                : JSON.stringify(toolCall.function.arguments, null, 2)}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : isSummary ? (
                // 总结消息使用折叠功能
                <div className="w-full">
                  <div className="flex items-center cursor-pointer p-1 user-select-none hover:bg-white/5 rounded-small" onClick={() => toggleToolCollapse(messageId)}>
                    <span className="mr-2 text-[0.8em] text-theme-green transition-transform">{isCollapsed ? '▶' : '▼'}</span>
                    <span className={`flex-1 text-theme-white whitespace-pre-wrap break-words overflow-wrap break-word break-words overflow-hidden w-full ${isCollapsed ? 'line-clamp-1' : ''}`}>
                      {isCollapsed ? (
                        // 折叠状态下显示总结预览
                        content.length > 50 ? content.substring(0, 50) + '...' : content
                      ) : (
                        // 展开状态下显示完整总结
                        '对话总结'
                      )}
                    </span>
                  </div>
                  {!isCollapsed && (
                    <div className="mt-2 p-3 bg-theme-green/10 rounded-small border-l-3 border-theme-green">
                      <ReactMarkdownMessageRenderer value={content} />
                    </div>
                  )}
                </div>
              ) : (
                // AI消息使用markdown渲染
                <div>
                  {/* 只有当有内容时才渲染markdown */}
                  {content && <ReactMarkdownMessageRenderer value={content} />}
                </div>
              )}
            </div>
          </div>
        );
      })}
      
      {/* 显示当前正在输入的AI消息 - 流式传输时显示 */}
      {currentAiMessage && (
        <div className="flex flex-col max-w-[80%] p-2.5-[10px] p-2.5-[15px] rounded-medium break-words overflow-wrap break-word self-start bg-theme-gray1 text-theme-white">
          <div className="font-bold mb-1.25 text-[0.9em]">AI</div>
          <div className="leading-[1.4] overflow-wrap break-word break-words">
            <ReactMarkdownMessageRenderer value={currentAiMessage} />
            {isLoading && <span className="inline-block animate-blink">...</span>}
          </div>
        </div>
      )}
    </div>
  );
};

export default MessageDisplay;
