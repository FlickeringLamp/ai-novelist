import { useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import type { RootState } from '../../store/store';

// 类型定义
interface ToolCall {
  name?: string;
  function?: {
    name?: string;
    arguments?: string | Record<string, unknown>;
  };
  args?: Record<string, unknown>;
}

interface UsageMetadata {
  input_tokens?: number;
  output_tokens?: number;
  total_tokens?: number;
  input_token_details?: {
    cache_read?: number;
  };
  output_token_details?: Record<string, unknown>;
}

interface Message {
  id: string;
  type: string; // 'human' | 'ai' | 'tool'，从state中读取
  content?: string;
  tool_calls?: ToolCall[];
  // 存储使用元数据
  usage_metadata?: UsageMetadata;
}

interface MessageDisplayPanelProps {
  messages: Message[];
}

const MessageDisplayPanel = ({ messages }: MessageDisplayPanelProps) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [expandedTools, setExpandedTools] = useState<Set<string>>(new Set());
  
  // 从Redux获取可用工具信息
  const availableTools = useSelector((state: RootState) => state.modeSlice.availableTools);

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

  // 当消息列表变化时自动滚动到底部
  const scrollRef = useRef(messages.length);
  if (messages.length !== scrollRef.current) {
    scrollRef.current = messages.length;
    setTimeout(scrollToBottom, 0);
  }

  // 渲染消息
  const renderMessage = (msg: Message) => {
    const isUser = msg.type === 'human';
    const isToolRequest = msg.type === 'tool_request';
    
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
          {isUser ? '用户' : isToolRequest ? '工具请求' : 'AI'}
        </div>
        <div className="leading-[1.4] overflow-wrap break-word break-words">
          {isUser ? (
            <div className="whitespace-pre-wrap">{msg.content}</div>
          ) : isToolRequest ? (
            <div>
              <div className="text-theme-green font-bold mb-2">
                {msg.tool_calls && msg.tool_calls.length > 0
                  ? `工具请求 (${msg.tool_calls.length}个工具)`
                  : '工具请求'}
              </div>
              {msg.tool_calls && msg.tool_calls.length > 0 && (
                <div className="mt-2 p-2 bg-black/20 rounded-small">
                  {msg.tool_calls.map((toolCall, toolIndex) => {
                    const toolKey = `${msg.id}-${toolIndex}`;
                    const isExpanded = expandedTools.has(toolKey);
                    const args = toolCall.args || toolCall.function?.arguments;
                    const path = args && typeof args === 'object' && 'path' in args ? (args as any).path : null;
                    
                    return (
                      <div key={toolIndex} className="mb-1.5 p-1 bg-black/10 rounded-small">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-theme-green">
                            {availableTools[toolCall.name || '']?.name || toolCall.name || '未知工具'}
                          </span>
                          <button
                            className="text-xs text-theme-green cursor-pointer hover:text-theme-white"
                            onClick={() => toggleToolExpand(msg.id, toolIndex)}
                          >
                            {isExpanded ? '▼' : '▶'}
                          </button>
                          {path && (
                            <span className="text-xs text-theme-gray3">
                              {path}
                            </span>
                          )}
                        </div>
                        {isExpanded && args && (
                          <div className="mt-1 text-[0.8em] text-theme-white whitespace-pre-wrap break-words">
                            {typeof args === 'string' ? JSON.parse(args) : JSON.stringify(args, null, 2)}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            <div>
              <div className="whitespace-pre-wrap">{msg.content}</div>
              {msg.tool_calls && msg.tool_calls.length > 0 && (
                <div className="mt-2 p-2 bg-black/20 rounded-small">
                  {msg.tool_calls.map((toolCall, toolIndex) => {
                    const toolKey = `${msg.id}-${toolIndex}`;
                    const isExpanded = expandedTools.has(toolKey);
                    const args = toolCall.args || toolCall.function?.arguments;
                    const path = args && typeof args === 'object' && 'path' in args ? (args as any).path : null;
                    
                    return (
                      <div key={toolIndex} className="mb-1.5 p-1 bg-black/10 rounded-small">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-theme-green">
                            {availableTools[toolCall.name || '']?.name || '未知工具'}
                          </span>
                          <button
                            className="text-xs text-theme-green cursor-pointer hover:text-theme-white"
                            onClick={() => toggleToolExpand(msg.id, toolIndex)}
                          >
                            {isExpanded ? '▼' : '▶'}
                          </button>
                          {path && (
                            <span className="text-xs text-theme-gray3">
                              {path}
                            </span>
                          )}
                        </div>
                        {isExpanded && args && (
                          <div className="mt-1 text-[0.8em] text-theme-white whitespace-pre-wrap break-words">
                            {(args as any)._loading
                              ? `加载中... ${(args as any)._partial_args || ''}`
                              : (() => {
                                  const parsedArgs = typeof args === 'string' ? JSON.parse(args) : args;
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
                                })()
                            }
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
              {msg.usage_metadata && (
                <div className="mt-2 text-[0.75em] text-theme-gray3">
                  输入: {msg.usage_metadata.input_tokens} / 输出: {msg.usage_metadata.output_tokens}
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
export type { Message, ToolCall, UsageMetadata };
