import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFileLines, faPlus, faPaperPlane, faClock, faAngleRight, faAngleUp } from '@fortawesome/free-solid-svg-icons';
import { useState, useRef, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import type { RootState } from '../../store/store';
import { setAllModesData, setSelectedModeId, setAvailableTools } from '../../store/mode';
import ModelSelectorPanel from './ModelSelectorPanel';
import MessageDisplayPanel, { type Message, type ToolCall } from './MessageDisplayPanel';
import ContextProgressBar from './ContextProgressBar';
import httpClient from '../../utils/httpClient';

// 中断信息接口
interface InterruptInfo {
  id?: string;
  tool_name?: string;
  tool_display_name?: string;
  description?: string;
  parameters?: any;
  isSimpleInterrupt?: boolean;
  question?: string;
}

// 中断响应接口
interface InterruptResponse {
  action: 'approve' | 'reject';
  choice?: string;
  additionalData?: string;
}

interface StreamChunk {
  type?: string;
  content?: string;
  error?: string;
  tool_calls?: any[];
  interrupts?: any[];
  // LangChain 消息对象的完整数据
  id?: string;
  additional_kwargs?: any;
  response_metadata?: any;
  usage_metadata?: any;
  invalid_tool_calls?: any;
  tool_call_chunks?: Array<{
    name?: string | null;
    args?: string | null;
    id?: string | null;
    index?: number;
    type?: string;
  }>;
  chunk_position?: string;
  // 完整state
  state?: any;
}

const ChatPanel = () => {
  const dispatch = useDispatch();
  const [modeExpanded, setModeExpanded] = useState(false);
  const [autoApproveExpanded, setAutoApproveExpanded] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  // 存储完整的state对象
  const [state, setState] = useState<any>(null);
  // 中断信息状态
  const [interruptInfo, setInterruptInfo] = useState<InterruptInfo | null>(null);
  
  // 从Redux获取状态
  const allProvidersData = useSelector((state: RootState) => state.providerSlice.allProvidersData);
  const selectedProviderId = useSelector((state: RootState) => state.providerSlice.selectedProviderId);
  const selectedModelId = useSelector((state: RootState) => state.providerSlice.selectedModelId);
  const allModesData = useSelector((state: RootState) => state.modeSlice.allModesData);
  const selectedModeId = useSelector((state: RootState) => state.modeSlice.selectedModeId);
  
  // 从state中获取messages
  const messages = state?.values?.messages || [];
  
  // 计算当前使用的tokens（从state中获取）
  const getCurrentTokens = (): number => {
    if (!state?.values?.messages) return 0;
    let totalTokens = 0;
    for (const msg of state.values.messages) {
      if (msg.usage_metadata?.total_tokens) {
        totalTokens += msg.usage_metadata.total_tokens;
      }
    }
    return totalTokens;
  };
  const currentTokens = getCurrentTokens();
  
  // 生成唯一消息ID（类似LangChain的格式：lc_run--uuid）
  const generateMessageId = () => {
    const uuid = crypto.randomUUID();
    return `lc_run--${uuid}`;
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
  }, [dispatch]);

  // 发送消息到后端
  const sendMessage = async function* (message: string, messageId: string) {
    try {
      const response = await httpClient.streamRequest('/api/chat/message', {
        method: 'POST',
        body: { message: message, id: messageId }
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
    const userMessageId = generateMessageId();
    
    setIsLoading(true);
    setError('');
    setMessage('');

    // 先添加用户消息到state中
    setState((prevState: any) => {
      const newMessages = [...(prevState?.values?.messages || [])];
      newMessages.push({
        id: userMessageId,
        type: 'human',
        content: inputMessage
      });
      return {
        ...prevState,
        values: {
          ...prevState?.values,
          messages: newMessages
        }
      };
    });

    try {
      const result = sendMessage(inputMessage, userMessageId);
      let currentAiMessageId: string | null = null;
      let newAiResponse = "";
      let currentRawData: any = null;
      // 存储流式工具调用chunks，用于累积构建完整的工具调用
      const toolCallChunksMap = new Map<number, { name?: string; args: string; id?: string }>();

      for await (const chunk of result) {
        // 按行分割chunk，处理多个JSON对象的情况
        // 原因：后端在每个JSON后添加了换行符\n作为分隔符，但由于网络传输缓冲区的原因，
        // 前端可能一次收到多个JSON对象（如：{"content": "的吗"}\n{"content": "？"}\n）
        // 直接对整个chunk进行JSON.parse会失败，需要按行分割后逐个解析
        // 这样可以避免消息显示不全、隔三岔五缺字符的问题
        const lines = chunk.split('\n').filter(line => line.trim() !== '');
        
        for (const line of lines) {
          // 尝试解析JSON
          try {
            const parsedChunk = JSON.parse(line) as StreamChunk;
            console.log("解析后的数据：", parsedChunk);

            // 处理不同类型的消息
            if (parsedChunk.error) {
              throw new Error(parsedChunk.error);
            }

            // 处理流式消息
            if (parsedChunk.type === 'AIMessageChunk') {
              // 处理 AIMessageChunk 消息对象
              if (!currentAiMessageId && parsedChunk.id) {
                // 使用 LangChain 消息对象的 id
                const messageId = parsedChunk.id;
                currentAiMessageId = messageId;
                currentRawData = parsedChunk;
                
                // 创建临时AI消息用于流式显示
                setState((prevState: any) => {
                  const newMessages = [...(prevState?.values?.messages || [])];
                  newMessages.push({
                    id: messageId,
                    type: 'ai',
                    content: '',
                    tool_calls: [],
                    usage_metadata: parsedChunk.usage_metadata
                  });
                  return {
                    ...prevState,
                    values: {
                      ...prevState?.values,
                      messages: newMessages
                    }
                  };
                });
              }

              // 有content就更新content
              if (parsedChunk.content) {
                newAiResponse += parsedChunk.content;
              }

              // 有工具调用的chunk就更新工具调用
              if (parsedChunk.tool_call_chunks && parsedChunk.tool_call_chunks.length > 0) {
                for (const chunk of parsedChunk.tool_call_chunks) {
                  const index = chunk.index ?? 0;
                  if (!toolCallChunksMap.has(index)) {
                    toolCallChunksMap.set(index, { args: '' });
                  }
                  const existing = toolCallChunksMap.get(index)!;
                  if (chunk.name !== null && chunk.name !== undefined) {
                    (existing as any).name = chunk.name;
                  }
                  if (chunk.args) {
                    existing.args += chunk.args;
                  }
                  if (chunk.id !== null && chunk.id !== undefined) {
                    (existing as any).id = chunk.id;
                  }
                }
              }

              // 有chunk_position: "last"就意味着有元数据，那么再更新一次元数据
              if (parsedChunk.chunk_position === 'last') {
                // 更新currentRawData以包含usage_metadata
                currentRawData = parsedChunk;
              }

              // 更新AI消息
              if (currentAiMessageId) {
                // 将累积的工具调用chunks转换为ToolCall数组
                const toolCalls: ToolCall[] = [];
                for (const [index, chunk] of toolCallChunksMap.entries()) {
                  const chunkWithName = chunk as any;
                  if (chunk.args) {
                    try {
                      const args = JSON.parse(chunk.args);
                      toolCalls.push({
                        name: chunkWithName.name || 'unknown',
                        args: args
                      });
                    } catch (e) {
                      // 如果args不是完整的JSON，仍然显示工具调用，但标记为加载中
                      toolCalls.push({
                        name: chunkWithName.name || 'unknown',
                        args: { _loading: true, _partial_args: chunk.args }
                      });
                    }
                  }
                }

                setState((prevState: any) => {
                  const newMessages = [...(prevState?.values?.messages || [])];
                  const aiMessageIndex = newMessages.findIndex(msg => msg.id === currentAiMessageId);
                  if (aiMessageIndex !== -1) {
                    const currentMessage = newMessages[aiMessageIndex];
                    if (currentMessage) {
                      newMessages[aiMessageIndex] = {
                        id: currentMessage.id,
                        type: currentMessage.type,
                        content: newAiResponse,
                        tool_calls: toolCalls,
                        usage_metadata: currentRawData?.usage_metadata
                      };
                    }
                  }
                  return {
                    ...prevState,
                    values: {
                      ...prevState?.values,
                      messages: newMessages
                    }
                  };
                });
              }
            }
          } catch (e) {
            // 如果不是JSON，则忽略
            console.log('无法解析chunk:', line);
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '发送消息失败');
      // 恢复输入框内容
      setMessage(inputMessage);
    } finally {
      setIsLoading(false);
      
      // 流式传输结束后，获取最终状态
      try {
        const finalState = await httpClient.get('/api/chat/state');
        setState(finalState);
        console.log("获取最终状态成功");
        
        // 检查是否有中断信息
        if (finalState?.interrupts && finalState.interrupts.length > 0) {
          const interrupt = finalState.interrupts[0];
          if (interrupt.value && interrupt.value.tool_name) {
            const toolInfo = interrupt.value;
            toolInfo.id = interrupt.id;
            
            // 对于 ask_user 工具，只传递必要的信息用于渲染按钮
            if (toolInfo.tool_name === 'ask_user') {
              setInterruptInfo({
                ...toolInfo,
                isSimpleInterrupt: true
              });
            } else {
              setInterruptInfo(toolInfo);
            }
          }
        } else {
          setInterruptInfo(null);
        }
      } catch (error) {
        console.error('获取最终状态失败:', error);
      }
    }
  };

  // 处理键盘事件
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // 处理中断响应
  const handleInterruptResponse = async (response: InterruptResponse) => {
    console.log('处理中断响应:', response);
    
    try {
      const interruptResponse = {
        interruptId: interruptInfo!.id,
        choice: response.choice || (response.action === 'approve' ? '1' : '2'), // '1'=恢复, '2'=取消
        additionalData: response.additionalData || ''
      };
      
      const responseStream = await httpClient.streamRequest('/api/chat/interrupt-response', {
        method: 'POST',
        body: {
          interrupt_id: interruptResponse.interruptId,
          choice: interruptResponse.choice,
          additional_data: interruptResponse.additionalData
        }
      } as any);
      
      // 清除中断信息
      setInterruptInfo(null);
      
      // 获取响应的ReadableStream
      const reader = responseStream.body!.getReader();
      const decoder = new TextDecoder();
      let currentAiMessageId: string | null = null;
      let newAiResponse = "";
      let currentRawData: any = null;
      const toolCallChunksMap = new Map<number, { name?: string; args: string; id?: string }>();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        // 解码并处理每个数据块
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n').filter(line => line.trim() !== '');
        
        for (const line of lines) {
          try {
            const parsedChunk = JSON.parse(line) as StreamChunk;
            console.log("解析后的数据：", parsedChunk);

            if (parsedChunk.error) {
              throw new Error(parsedChunk.error);
            }

            // 处理流式消息
            if (parsedChunk.type === 'AIMessageChunk') {
              if (!currentAiMessageId && parsedChunk.id) {
                const messageId = parsedChunk.id;
                currentAiMessageId = messageId;
                currentRawData = parsedChunk;
                
                setState((prevState: any) => {
                  const newMessages = [...(prevState?.values?.messages || [])];
                  newMessages.push({
                    id: messageId,
                    type: 'ai',
                    content: '',
                    tool_calls: [],
                    usage_metadata: parsedChunk.usage_metadata
                  });
                  return {
                    ...prevState,
                    values: {
                      ...prevState?.values,
                      messages: newMessages
                    }
                  };
                });
              }

              if (parsedChunk.content) {
                newAiResponse += parsedChunk.content;
              }

              if (parsedChunk.tool_call_chunks && parsedChunk.tool_call_chunks.length > 0) {
                for (const chunk of parsedChunk.tool_call_chunks) {
                  const index = chunk.index ?? 0;
                  if (!toolCallChunksMap.has(index)) {
                    toolCallChunksMap.set(index, { args: '' });
                  }
                  const existing = toolCallChunksMap.get(index)!;
                  if (chunk.name !== null && chunk.name !== undefined) {
                    (existing as any).name = chunk.name;
                  }
                  if (chunk.args) {
                    existing.args += chunk.args;
                  }
                  if (chunk.id !== null && chunk.id !== undefined) {
                    (existing as any).id = chunk.id;
                  }
                }
              }

              if (parsedChunk.chunk_position === 'last') {
                currentRawData = parsedChunk;
              }

              if (currentAiMessageId) {
                const toolCalls: ToolCall[] = [];
                for (const [index, chunk] of toolCallChunksMap.entries()) {
                  const chunkWithName = chunk as any;
                  if (chunk.args) {
                    try {
                      const args = JSON.parse(chunk.args);
                      toolCalls.push({
                        name: chunkWithName.name || 'unknown',
                        args: args
                      });
                    } catch (e) {
                      toolCalls.push({
                        name: chunkWithName.name || 'unknown',
                        args: { _loading: true, _partial_args: chunk.args }
                      });
                    }
                  }
                }

                setState((prevState: any) => {
                  const newMessages = [...(prevState?.values?.messages || [])];
                  const aiMessageIndex = newMessages.findIndex(msg => msg.id === currentAiMessageId);
                  if (aiMessageIndex !== -1) {
                    const currentMessage = newMessages[aiMessageIndex];
                    if (currentMessage) {
                      newMessages[aiMessageIndex] = {
                        id: currentMessage.id,
                        type: currentMessage.type,
                        content: newAiResponse,
                        tool_calls: toolCalls,
                        usage_metadata: currentRawData?.usage_metadata
                      };
                    }
                  }
                  return {
                    ...prevState,
                    values: {
                      ...prevState?.values,
                      messages: newMessages
                    }
                  };
                });
              }
            }
          } catch (e) {
            console.log('无法解析chunk:', line);
          }
        }
      }
      
      // 流式传输结束后，获取最终状态
      try {
        const finalState = await httpClient.get('/api/chat/state');
        setState(finalState);
        console.log("获取最终状态成功");
        
        // 检查是否有中断信息
        if (finalState?.interrupts && finalState.interrupts.length > 0) {
          const interrupt = finalState.interrupts[0];
          if (interrupt.value && interrupt.value.tool_name) {
            const toolInfo = interrupt.value;
            toolInfo.id = interrupt.id;
            
            if (toolInfo.tool_name === 'ask_user') {
              setInterruptInfo({
                ...toolInfo,
                isSimpleInterrupt: true
              });
            } else {
              setInterruptInfo(toolInfo);
            }
          }
        } else {
          setInterruptInfo(null);
        }
      } catch (error) {
        console.error('获取最终状态失败:', error);
      }
    } catch (error) {
      console.error('处理中断响应失败:', error);
      setInterruptInfo(null);
      setError('处理中断响应时发生错误');
    }
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
      <MessageDisplayPanel messages={messages} />

      {/* 输入区域 */}
      <div className="h-[15%] p-2.5 border border-theme-gray3 flex flex-col">
        {/* 工具确认界面 */}
        {interruptInfo && (
          <div className="bg-theme-gray1 rounded-medium shadow-light mb-2">
            {/* 只有非简化中断信息才显示工具描述 */}
            {!interruptInfo.isSimpleInterrupt && (
              <div className="bg-theme-black p-2">
                <span className="text-theme-green text-[15px] leading-[1.4]">
                  {interruptInfo.description || interruptInfo.tool_display_name || interruptInfo.tool_name || '工具调用请求'}
                </span>
              </div>
            )}
            
            <div className="flex gap-0">
              <button
                className="bg-theme-green text-theme-white border-none text-[13px] font-medium cursor-pointer transition-all flex-1 text-center py-2"
                onClick={() => handleInterruptResponse({ action: 'approve', choice: '1', additionalData: message })}
              >
                确认
              </button>
              <button
                className="bg-red-500 text-white border-none text-[13px] font-medium cursor-pointer transition-all flex-1 text-center py-2"
                onClick={() => handleInterruptResponse({ action: 'reject', choice: '2', additionalData: message })}
              >
                取消
              </button>
            </div>
          </div>
        )}
        
        {/* 输入框占位 */}
        <div className="flex w-full flex-1 relative overflow-visible">
          <textarea
            className="bg-theme-black text-theme-white border-none rounded-small resize-none font-inherit text-[14px] box-border flex-1 min-w-0 focus:outline-none"
            placeholder={interruptInfo ? "请输入额外信息（可选）..." : "输入@+空格可选择文件，同时按下shift+回车可换行"}
            rows={interruptInfo ? 2 : 3}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isLoading}
          />
          <button
            className="bg-transparent text-theme-green border-none cursor-pointer text-[16px] p-0 self-end flex items-center justify-center hover:text-theme-white disabled:text-theme-white disabled:cursor-not-allowed"
            onClick={handleSendMessage}
            disabled={!message.trim() || isLoading || !!interruptInfo}
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
