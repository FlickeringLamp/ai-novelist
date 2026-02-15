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
  setSelectedThreadId,
} from '../../store/chat';
import type { ToolCall,  StreamChunk } from '../../types/langchain';
import httpClient from '../../utils/httpClient';
import { tryCompleteJSON } from '../../utils/jsonUtils';
import { useFileToolHandler } from '../../utils/fileToolHandler';

const MessageInputPanel = () => {
  const dispatch = useDispatch();
  const { processFileToolCalls } = useFileToolHandler();
  
  // 从Redux获取状态
  const message = useSelector((state: RootState) => state.chatSlice.message);
  const selectedThreadId = useSelector((state: RootState) => state.chatSlice.selectedThreadId);
  
  // 本地错误状态
  const [error, setError] = useState('');
  
  // 生成唯一消息ID
  const generateMessageId = () => {
    const uuid = crypto.randomUUID();
    return `lc_run--${uuid}`;
  };

  // 生成随机thread_id
  const generateThreadId = () => {
    return `thread_${Date.now()}`;
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
    if (!message.trim()) return;

    const inputMessage = message.trim();
    const userMessageId = generateMessageId();
    
    setError('');
    dispatch(setMessage(''));

    // 如果没有选中thread_id，则创建新的
    let actualThreadId = selectedThreadId;
    if (!actualThreadId) {
      try {
        const newThreadId = generateThreadId();
        const result = await httpClient.post('/api/chat/update-thread', { thread_id: newThreadId });
        // 从后端返回的结果中获取thread_id
        actualThreadId = result?.thread_id;
        dispatch(setSelectedThreadId(actualThreadId));
        console.log("创建新会话成功，thread_id:", actualThreadId);
        
        // 从后端获取state
        const initialState = await httpClient.get('/api/chat/state');
        if (initialState && initialState.values) {
          initialState.values.messages = initialState.values.messages || [];
        }
        dispatch(setState(initialState));
        console.log("获取初始state成功");
      } catch (error) {
        console.error('创建新会话失败:', error);
        return;
      }
    }

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
                // 有content时立即更新，实现流式渲染
                if (currentAiMessageId) {
                  dispatch(updateAiMessage({
                    id: currentAiMessageId,
                    content: newAiResponse
                  }));
                }
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

                // 将 Map 转换为数组，保留所有工具调用
                const toolCalls: ToolCall[] = [];
                for (const [index, existing] of toolCallChunksMap.entries()) {
                  // 尝试解析 args 并构建 toolCalls
                  try {
                    const args = JSON.parse(existing.args);
                    toolCalls.push({
                      id: (existing as any).id || 'unknown',
                      name: (existing as any).name || 'unknown',
                      args: args,
                      type: 'tool_call'
                    });
                  } catch (e) {
                    const completedArgs = tryCompleteJSON(existing.args);
                    toolCalls.push({
                      id: (existing as any).id || 'unknown',
                      name: (existing as any).name || 'unknown',
                      args: { _loading: true, _partial_args: completedArgs },
                      type: 'tool_call'
                    });
                  }
                }

                dispatch(updateAiMessage({
                  id: currentAiMessageId!,
                  content: newAiResponse,
                  tool_calls: toolCalls
                }));

                // 立即处理文件工具调用
                processFileToolCalls(toolCalls);
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


  return (
    <>
      {/* 输入区域 */}
      <div className="h-[15%] p-2.5 border border-theme-gray3 flex flex-col">
        {/* 输入框占位 */}
        <div className="flex w-full flex-1 relative overflow-visible">
          <textarea
            className="bg-theme-black text-theme-white border-none rounded-small resize-none font-inherit text-[14px] box-border flex-1 min-w-0 focus:outline-none"
            placeholder="输入@+空格可选择文件，同时按下shift+回车可换行"
            rows={3}
            value={message}
            onChange={(e) => dispatch(setMessage(e.target.value))}
            onKeyDown={handleKeyDown}
          />
          <button
            className="bg-transparent text-theme-green border-none cursor-pointer text-[16px] p-0 self-end flex items-center justify-center hover:text-theme-white disabled:text-theme-white disabled:cursor-not-allowed"
            onClick={handleSendMessage}
            disabled={!message.trim()}
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
