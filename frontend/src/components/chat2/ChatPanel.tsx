import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFileLines, faPlus, faPaperPlane, faClock, faAngleRight, faAngleUp } from '@fortawesome/free-solid-svg-icons';
import { useState, useRef, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import type { RootState } from '../../store/store';
import { setAllModesData, setSelectedModeId } from '../../store/mode';
import ModelSelectorPanel from './ModelSelectorPanel';
import ContextProgressBar from './ContextProgressBar';
import httpClient from '../../utils/httpClient';

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
  role: 'user' | 'assistant' | 'tool' | 'tool_request';
  content?: string;
  tool_calls?: ToolCall[];
  // 存储完整的 LangChain 消息数据，以后使用
  raw?: any;
  // 存储使用元数据
  usage_metadata?: UsageMetadata;
}

interface StreamChunk {
  type?: string;
  content?: string;
  error?: string;
  tool_calls?: ToolCall[];
  interrupts?: any[];
  // LangChain 消息对象的完整数据
  id?: string;
  additional_kwargs?: any;
  response_metadata?: any;
  usage_metadata?: any;
  invalid_tool_calls?: any;
}

const ChatPanel = () => {
  const dispatch = useDispatch();
  const [modeExpanded, setModeExpanded] = useState(false);
  const [autoApproveExpanded, setAutoApproveExpanded] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  // 存储所有接收到的原始数据，以后使用
  const [rawMessages, setRawMessages] = useState<any[]>([]);
  
  // 从Redux获取状态
  const allProvidersData = useSelector((state: RootState) => state.providerSlice.allProvidersData);
  const selectedProviderId = useSelector((state: RootState) => state.providerSlice.selectedProviderId);
  const selectedModelId = useSelector((state: RootState) => state.providerSlice.selectedModelId);
  const allModesData = useSelector((state: RootState) => state.modeSlice.allModesData);
  const selectedModeId = useSelector((state: RootState) => state.modeSlice.selectedModeId);
  
  // 当前使用的tokens
  const [currentTokens, setCurrentTokens] = useState(0);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messageIdCounter = useRef(0);

  // 生成唯一消息ID
  const generateMessageId = () => {
    messageIdCounter.current += 1;
    return `${Date.now()}_${messageIdCounter.current}`;
  };

  // 自动滚动到最新消息
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // 计算当前模型的最大上下文长度
  const getModelContextLength = (): number => {
    if (!selectedProviderId || !selectedModelId) return 4096; // 默认值
    const providerData = allProvidersData[selectedProviderId as string];
    if (!providerData) return 4096;
    const contextLength = providerData.favoriteModels?.chat?.[selectedModelId as string];
    return typeof contextLength === 'number' ? contextLength : 4096;
  };

  // 计算当前模式的max_tokens
  const getModeMaxTokens = (): number => {
    if (!selectedModeId || !allModesData[selectedModeId]) return 4096;
    return allModesData[selectedModeId].max_tokens || 4096;
  };

  // 加载模式数据
  useEffect(() => {
    const loadModes = async () => {
      try {
        const modesResult = await httpClient.get('/api/mode/modes');
        dispatch(setAllModesData(modesResult));
        
        // 加载当前选中的模式
        const currentModeValue = await httpClient.get('/api/config/store?key=currentMode');
        if (currentModeValue) {
          dispatch(setSelectedModeId(currentModeValue));
        }
      } catch (error) {
        console.error('加载模式数据失败:', error);
      }
    };
    loadModes();
  }, [dispatch]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // 发送消息到后端
  const sendMessage = async function* (message: string) {
    try {
      const response = await httpClient.streamRequest('/api/chat/message', {
        method: 'POST',
        body: { message: message }
      } as any);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      // 获取响应的ReadableStream
      const reader = response.body!.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        // 解码并yield每个数据块
        const chunk = decoder.decode(value, { stream: true });
        yield chunk;
      }
    } catch (error) {
      console.log(error);
      throw error;
    }
  };

  // 处理发送消息
  const handleSendMessage = async () => {
    if (!message.trim() || isLoading) return;

    const inputMessage = message.trim();
    
    // 添加用户消息
    const userMessageId = generateMessageId();
    const userMessage: Message = {
      id: userMessageId,
      role: 'user',
      content: inputMessage
    };
    setMessages(prev => [...prev, userMessage]);
    
    setIsLoading(true);
    setError('');
    setMessage('');
    setCurrentTokens(0); // 重置当前使用的tokens

    try {
      const result = sendMessage(inputMessage);
      let currentAiMessageId: string | null = null;
      let newAiResponse = "";
      let currentToolCalls: ToolCall[] = [];
      let currentRawData: any = null;

      for await (const chunk of result) {
        // 尝试解析JSON
        try {
          const parsedChunk = JSON.parse(chunk) as StreamChunk;

          // 处理不同类型的消息
          if (parsedChunk.type === 'done') {
            break;
          }

          if (parsedChunk.error) {
            throw new Error(parsedChunk.error);
          }

          if (parsedChunk.type === 'interrupt') {
            // 处理中断信息
            if (parsedChunk.interrupts && parsedChunk.interrupts.length > 0) {
              const interrupt = parsedChunk.interrupts[0];
              if (interrupt.value && interrupt.value.tool_name) {
                currentToolCalls = [{
                  name: interrupt.value.tool_name,
                  args: interrupt.value.parameters || {}
                }];
              }
            }
          } else if (parsedChunk.content || parsedChunk.usage_metadata) {
            // 处理 LangChain 消息对象
            if (!currentAiMessageId && parsedChunk.id) {
              // 使用 LangChain 消息对象的 id
              const messageId = parsedChunk.id;
              currentAiMessageId = messageId;
              currentRawData = parsedChunk;
              
              // 创建AI消息
              setMessages(prev => [...prev, {
                id: messageId,
                role: 'assistant',
                content: '',
                tool_calls: [],
                raw: parsedChunk,
                usage_metadata: parsedChunk.usage_metadata
              }]);
            } else if (parsedChunk.usage_metadata) {
              // 更新currentRawData以包含usage_metadata
              currentRawData = parsedChunk;
              // 更新当前使用的tokens
              if (parsedChunk.usage_metadata.total_tokens) {
                setCurrentTokens(parsedChunk.usage_metadata.total_tokens);
              }
            }

            // 累积内容
            if (parsedChunk.content) {
              newAiResponse += parsedChunk.content;
            }
            
            // 更新AI消息
            if (currentAiMessageId) {
              setMessages(prev => {
                const newMessages = [...prev];
                const aiMessageIndex = newMessages.findIndex(msg => msg.id === currentAiMessageId);
                if (aiMessageIndex !== -1) {
                  const currentMessage = newMessages[aiMessageIndex];
                  if (currentMessage) {
                    newMessages[aiMessageIndex] = {
                      id: currentMessage.id,
                      role: currentMessage.role,
                      content: newAiResponse,
                      tool_calls: currentMessage.tool_calls || [],
                      raw: currentRawData,
                      usage_metadata: currentRawData?.usage_metadata
                    };
                  }
                }
                return newMessages;
              });
            }
          }
        } catch (e) {
          // 如果不是JSON，则忽略
          console.log('无法解析chunk:', chunk);
        }
      }

      // 添加工具请求消息
      if (currentToolCalls.length > 0) {
        const toolRequestMessage: Message = {
          id: generateMessageId(),
          role: 'tool_request',
          content: '',
          tool_calls: currentToolCalls
        };
        setMessages(prev => [...prev, toolRequestMessage]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '发送消息失败');
      // 恢复输入框内容
      setMessage(inputMessage);
    } finally {
      setIsLoading(false);
    }
  };

  // 处理键盘事件
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // 渲染消息
  const renderMessage = (msg: Message) => {
    const isUser = msg.role === 'user';
    const isTool = msg.role === 'tool';
    const isToolRequest = msg.role === 'tool_request';
    
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
          {isUser ? '用户' : isTool ? '工具' : isToolRequest ? '工具请求' : 'AI'}
        </div>
        <div className="leading-[1.4] overflow-wrap break-word break-words">
          {isUser ? (
            <div className="whitespace-pre-wrap">{msg.content}</div>
          ) : isTool || isToolRequest ? (
            <div>
              <div className="whitespace-pre-wrap">{msg.content}</div>
              {msg.tool_calls && msg.tool_calls.length > 0 && (
                <div className="mt-2 p-2 bg-black/20 rounded-small">
                  <div className="font-bold mb-1 text-theme-green">工具:</div>
                  {msg.tool_calls.map((toolCall, toolIndex) => (
                    <div key={toolIndex} className="mb-1.5 p-1 bg-black/10 rounded-small">
                      <span className="font-bold text-theme-green">
                        {toolCall.name || toolCall.function?.name || '未知工具'}
                      </span>
                      {toolCall.args && (
                        <div className="mt-1 text-[0.8em] text-theme-white whitespace-pre-wrap break-words">
                          参数: {JSON.stringify(toolCall.args, null, 2)}
                        </div>
                      )}
                      {toolCall.function?.arguments && (
                        <div className="mt-1 text-[0.8em] text-theme-white whitespace-pre-wrap break-words">
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
          ) : (
            <div>
              <div className="whitespace-pre-wrap">{msg.content}</div>
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
      <ContextProgressBar currentTokens={currentTokens} />
      
      {/* 消息显示区域 */}
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

      {/* 输入区域 */}
      <div className="h-[15%] p-2.5 border border-theme-gray3">
        {/* 输入框占位 */}
        <div className="flex w-full flex-1 relative overflow-visible">
          <textarea
            className="bg-theme-black text-theme-white border-none rounded-small resize-none font-inherit text-[14px] box-border flex-1 min-w-0 focus:outline-none"
            placeholder="输入@+空格可选择文件，同时按下shift+回车可换行"
            rows={3}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isLoading}
          />
          <button
            className="bg-transparent text-theme-green border-none cursor-pointer text-[16px] p-0 self-end flex items-center justify-center hover:text-theme-white disabled:text-theme-white disabled:cursor-not-allowed"
            onClick={handleSendMessage}
            disabled={!message.trim() || isLoading}
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


      {/* 错误弹窗 */}
      {error && (
        <div className="fixed inset-0 flex items-center justify-center z-50 bg-black bg-opacity-50">
          <div className="bg-theme-black border border-theme-gray3 rounded-small p-4 max-w-md w-full mx-4">
            <div className="text-theme-green text-lg mb-2">错误</div>
            <div className="text-theme-white text-sm mb-4">{error}</div>
            <button
              className="w-full bg-theme-green text-theme-white border-none rounded-small py-2 cursor-pointer hover:bg-theme-white hover:text-theme-green transition-all"
              onClick={() => setError('')}
            >
              确定
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatPanel;
