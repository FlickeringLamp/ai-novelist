import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPaperPlane } from '@fortawesome/free-solid-svg-icons';
import { useDispatch, useSelector } from 'react-redux';
import { useState } from 'react';
import type { RootState } from '../../store/store';
import {
  addUserMessage,
  createAiMessage,
  updateAiMessage,
  setState,
  setMessage,
  selectInterrupt,
  selectIsLoading,
} from '../../store/chat';
import type { ToolCall, UsageMetadata } from '../../types/langchain';
import httpClient from '../../utils/httpClient';

// 中断响应接口
interface InterruptResponse {
  action: 'approve' | 'reject';
  choice?: string;
  additionalData?: string;
}

// 无效工具调用接口
interface InvalidToolCall {
  name?: string;
  id?: string;
  args?: string;
  error?: string;
}

// 工具调用接口
interface ToolCallChunk {
  name?: string | null;
  args?: string | null;
  id?: string | null;
  index?: number;
  type?: string;
}

interface StreamChunk {
  type?: string;
  content?: string;
  tool_calls?: ToolCall[];
  id?: string;
  name?: string | null;
  additional_kwargs?: Record<string, unknown>;
  response_metadata?: Record<string, unknown>;
  usage_metadata?: UsageMetadata | null; // 当chunk_position为"last"时才不为null
  invalid_tool_calls?: InvalidToolCall[];
  tool_call_chunks?: ToolCallChunk[];
  chunk_position?: string | null;
}

const MessageInputPanel = () => {
  const dispatch = useDispatch();
  
  // 从Redux获取状态
  const interrupt = useSelector((state: RootState) => selectInterrupt(state));
  const isLoading = useSelector((state: RootState) => selectIsLoading(state));
  const message = useSelector((state: RootState) => state.chatSlice.message);
  
  // 本地错误状态
  const [error, setError] = useState('');
  
  // 判断是否是简单中断（ask_user工具）
  const isSimpleInterrupt = interrupt?.value?.tool_name === 'ask_user';
  
  // 生成唯一消息ID
  const generateMessageId = () => {
    const uuid = crypto.randomUUID();
    return `lc_run--${uuid}`;
  };

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

      const reader = response.body!.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

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
    
    setError('');
    dispatch(setMessage(''));

    dispatch(addUserMessage({ id: userMessageId, content: inputMessage }));

    try {
      const result = sendMessage(inputMessage, userMessageId);
      let currentAiMessageId: string | null = null;
      let newAiResponse = "";
      const toolCallChunksMap = new Map<number, { name?: string; args: string; id?: string }>();

      for await (const chunk of result) {
        const lines = chunk.split('\n').filter(line => line.trim() !== '');
        
        for (const line of lines) {
          try {
            const parsedChunk = JSON.parse(line) as StreamChunk;
            console.log("解析后的数据：", parsedChunk);

            if (parsedChunk.type === 'AIMessageChunk') {
              if (!currentAiMessageId && parsedChunk.id) {
                const messageId = parsedChunk.id;
                currentAiMessageId = messageId;
                 
                dispatch(createAiMessage({ id: messageId }));
              }

              if (parsedChunk.content) {
                newAiResponse += parsedChunk.content;
              }

              if (parsedChunk.tool_call_chunks && parsedChunk.tool_call_chunks.length > 0) {
                const toolCalls: ToolCall[] = [];
                
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

                  // 尝试解析 args 并构建 toolCalls
                  try {
                    const args = JSON.parse(existing.args);
                    toolCalls[index] = {
                      id: (existing as any).id || 'unknown',
                      name: (existing as any).name || 'unknown',
                      args: args,
                      type: 'tool_call'
                    };
                  } catch (e) {
                    toolCalls[index] = {
                      id: (existing as any).id || 'unknown',
                      name: (existing as any).name || 'unknown',
                      args: { _loading: true, _partial_args: existing.args },
                      type: 'tool_call'
                    };
                  }
                }

                dispatch(updateAiMessage({
                  id: currentAiMessageId!,
                  content: newAiResponse,
                  tool_calls: toolCalls
                }));
              }
            }
          } catch (e) {
            console.log('无法解析chunk:', line);
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '发送消息失败');
      dispatch(setMessage(inputMessage));
    }
    
    // 获取最终状态
    try {
      const finalState = await httpClient.get('/api/chat/state');
      dispatch(setState(finalState));
      console.log("获取最终状态成功");
    } catch (error) {
      console.error('获取最终状态失败:', error);
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
        interruptId: interrupt!.id,
        choice: response.choice || (response.action === 'approve' ? '1' : '2'),
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
      
      dispatch(setMessage(''));
      
      const reader = responseStream.body!.getReader();
      const decoder = new TextDecoder();
      let currentAiMessageId: string | null = null;
      let newAiResponse = "";
      const toolCallChunksMap = new Map<number, { name?: string; args: string; id?: string }>();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n').filter(line => line.trim() !== '');
        
        for (const line of lines) {
          try {
            const parsedChunk = JSON.parse(line) as StreamChunk;
            console.log("解析后的数据：", parsedChunk);

            if (parsedChunk.type === 'AIMessageChunk') {
              if (!currentAiMessageId && parsedChunk.id) {
                const messageId = parsedChunk.id;
                currentAiMessageId = messageId;
                 
                dispatch(createAiMessage({ id: messageId }));
              }

              if (parsedChunk.content) {
                newAiResponse += parsedChunk.content;
              }

              if (parsedChunk.tool_call_chunks && parsedChunk.tool_call_chunks.length > 0) {
                const toolCalls: ToolCall[] = [];
                
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

                  // 尝试解析 args 并构建 toolCalls
                  try {
                    const args = JSON.parse(existing.args);
                    toolCalls[index] = {
                      id: (existing as any).id || 'unknown',
                      name: (existing as any).name || 'unknown',
                      args: args,
                      type: 'tool_call'
                    };
                  } catch (e) {
                    toolCalls[index] = {
                      id: (existing as any).id || 'unknown',
                      name: (existing as any).name || 'unknown',
                      args: { _loading: true, _partial_args: existing.args },
                      type: 'tool_call'
                    };
                  }
                }

                dispatch(updateAiMessage({
                  id: currentAiMessageId!,
                  content: newAiResponse,
                  tool_calls: toolCalls
                }));
              }
            } else if (parsedChunk.type === 'tool') {
              console.log('收到ToolMessage，刷新文件树');
              try {
                const { setChapters } = await import('../../store/file');
                const chapters = await httpClient.get('/api/file/tree');
                dispatch(setChapters(chapters || []));
              } catch (error) {
                console.error('刷新文件树失败:', error);
              }
            }
          } catch (e) {
            console.log('无法解析chunk:', line);
          }
        }
      }
      
      // 获取最终状态
      try {
        const finalState = await httpClient.get('/api/chat/state');
        dispatch(setState(finalState));
        console.log("获取最终状态成功");
      } catch (error) {
        console.error('获取最终状态失败:', error);
      }
    } catch (error) {
      console.error('处理中断响应失败:', error);
      setError('处理中断响应时发生错误');
    }
  };

  return (
    <>
      {/* 输入区域 */}
      <div className="h-[15%] p-2.5 border border-theme-gray3 flex flex-col">
        {/* 工具确认界面 */}
        {interrupt && (
          <div className="bg-theme-gray1 rounded-medium shadow-light mb-2">
            {!isSimpleInterrupt && (
              <div className="bg-theme-black p-2">
                <span className="text-theme-green text-[15px] leading-[1.4]">
                  {interrupt.value.description || interrupt.value.tool_display_name || interrupt.value.tool_name || '工具调用请求'}
                </span>
              </div>
            )}
             
            <div className="flex gap-0">
              <button
                className="bg-theme-green text-theme-white border-none text-[13px] font-medium cursor-pointer transition-all flex-1 text-center py-2"
                onClick={() => handleInterruptResponse({ action: 'approve', choice: '1', additionalData: message || '' })}
              >
                确认
              </button>
              <button
                className="bg-red-500 text-white border-none text-[13px] font-medium cursor-pointer transition-all flex-1 text-center py-2"
                onClick={() => handleInterruptResponse({ action: 'reject', choice: '2', additionalData: message || '' })}
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
            placeholder={interrupt ? "请输入额外信息（可选）..." : "输入@+空格可选择文件，同时按下shift+回车可换行"}
            rows={interrupt ? 2 : 3}
            value={message}
            onChange={(e) => dispatch(setMessage(e.target.value))}
            onKeyDown={handleKeyDown}
            disabled={isLoading}
          />
          <button
            className="bg-transparent text-theme-green border-none cursor-pointer text-[16px] p-0 self-end flex items-center justify-center hover:text-theme-white disabled:text-theme-white disabled:cursor-not-allowed"
            onClick={handleSendMessage}
            disabled={!message.trim() || isLoading || !!interrupt}
          >
            <FontAwesomeIcon icon={faPaperPlane} />
          </button>
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
    </>
  );
};

export default MessageInputPanel;
