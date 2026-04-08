import { useRef, useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faAngleRight, faAngleUp, faTrash, faRotateRight, faEdit, faCopy, faCheck } from '@fortawesome/free-solid-svg-icons';
import type { RootState } from '../../types';
import type { Message, AIMessage, StreamChunk, ToolCall } from '../../types/langgraph';
import { setAvailableTools } from '../../store/mode';
import { setState, createAiMessage, updateAiMessage, setIsStreaming } from '../../store/chat';
import httpClient from '../../utils/httpClient';
import UnifiedModal from '../others/UnifiedModal';
import { tryCompleteJSON } from '../../utils/jsonUtils';
import { useFileToolHandler } from '../../utils/fileToolHandler';

const MessageDisplayPanel = () => {
  const dispatch = useDispatch();
  const { processFileToolCalls } = useFileToolHandler();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [expandedTools, setExpandedTools] = useState<Set<string>>(new Set());
  const [expandedToolResults, setExpandedToolResults] = useState<Set<string>>(new Set());
  const [expandedReasonings, setExpandedReasonings] = useState<Set<string>>(new Set());
  const emptyMessages: Message[] = [];
  const emptyInterrupts: any[] = [];
  // 消息模态框状态
  const [modal, setModal] = useState<{ show: boolean; message: string; onConfirm: (() => void) | null; onCancel: (() => void) | null }>({
    show: false,
    message: '',
    onConfirm: null,
    onCancel: null
  });
  
  // 内联编辑状态
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState<string>('');
  const [editingMessageType, setEditingMessageType] = useState<'human' | 'ai'>('human');
  
  // 从Redux获取可用工具信息
  const availableTools = useSelector((state: RootState) => state.modeSlice.availableTools);
  
  // 从Redux获取消息列表
  const messages = useSelector((state: RootState) => state.chatSlice.state?.values?.messages || emptyMessages);
  
  // 从Redux获取thread_id和mode
  const threadId = useSelector((state: RootState) => state.chatSlice.selectedThreadId) || 'default';
  const selectedModeId = useSelector((state: RootState) => state.modeSlice.selectedModeId) || '管家agent';
  
  // 从Redux获取中断状态
  const interrupts = useSelector((state: RootState) => state.chatSlice.state?.interrupts || emptyInterrupts);
  const isInterrupted = interrupts.length > 0;

  // 加载可用工具数据
  useEffect(() => {
    const loadTools = async () => {
      try {
        const toolsResult = await httpClient.get('/api/mode/tool/available-tools');
        if (toolsResult) {
          dispatch(setAvailableTools(toolsResult));
        }
      } catch (error) {
        setModal({ show: true, message: (error as Error).toString(), onConfirm: null, onCancel: null });
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

  // 切换思维链展开/折叠状态
  const toggleReasoningExpand = (msgId: string) => {
    setExpandedReasonings(prev => {
      const newSet = new Set(prev);
      if (newSet.has(msgId)) {
        newSet.delete(msgId);
      } else {
        newSet.add(msgId);
      }
      return newSet;
    });
  };

  // 复制消息内容到剪贴板
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const copyMessage = async (content: string, msgId: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedMessageId(msgId);
      setTimeout(() => setCopiedMessageId(null), 2000);
    } catch (error) {
      setModal({ show: true, message: '复制失败: ' + (error as Error).toString(), onConfirm: null, onCancel: null });
    }
  };

  // 删除消息
  const deleteMessage = async (msgId: string) => {
    try {
      // 查找要删除的消息
      const messageToDelete = messages.find(msg => msg.id === msgId);
      
      // 收集所有需要删除的消息 ID
      const idsToDelete: string[] = [msgId];
      
      // 如果是 AI 消息，还需要删除其 tool_calls 对应的 ToolMessage
      if (messageToDelete?.type === 'ai') {
        const aiMessage = messageToDelete as AIMessage;
        if (aiMessage.tool_calls && aiMessage.tool_calls.length > 0) {
          // 获取所有工具调用的 call_id
          const toolCallIds = aiMessage.tool_calls.map(toolCall => toolCall.id);
          
          // 在所有消息中查找对应的 ToolMessage
          toolCallIds.forEach(callId => {
            const toolMessage = messages.find(msg =>
              msg.type === 'tool' && (msg as any).tool_call_id === callId
            );
            if (toolMessage) {
              idsToDelete.push(toolMessage.id);
            }
          });
        }
      }
      console.log("idsToDelete:",idsToDelete)
      const a = await httpClient.post('/api/history/messages/operation', {
        thread_id: threadId,
        target_ids: idsToDelete,
        mode: selectedModeId
      });
      console.log("a",a)

      // 重新获取状态以刷新显示
      const finalState = await httpClient.get('/api/chat/state');
      dispatch(setState(finalState));
      console.log("state,",finalState)
    } catch (error) {
      setModal({ show: true, message: (error as Error).toString(), onConfirm: null, onCancel: null });
    }
  };

  // 重新生成消息（流式处理）
  const regenerateMessage = async (msgId: string, messageType: 'human' | 'ai') => {
    try {
      dispatch(setIsStreaming(true));

      const response = await httpClient.streamRequest('/api/history/regenerate/stream', {
        method: 'POST',
        body: {
          thread_id: threadId,
          message_id: msgId,
          message_type: messageType
        }
      });

      if (!response.ok) {
        throw new Error('重新生成请求失败');
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('无法获取响应流');
      }

      const decoder = new TextDecoder();
      let currentAiMessageId: string | null = null;
      let newAiResponse = "";
      let newReasoningContent = "";
      const toolCallChunksMap = new Map<number, { name?: string; args: string; id?: string }>();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n').filter(line => line.trim() !== '');

        for (const line of lines) {
          try {
            const parsedChunk = JSON.parse(line) as StreamChunk;

            // 处理流式传输中断信号
            if (parsedChunk.interrupted) {
              console.log("重新生成被中断");
              dispatch(setIsStreaming(false));
              break;
            }

            if (parsedChunk.type === 'AIMessageChunk') {
              if (!currentAiMessageId && parsedChunk.id) {
                const messageId = parsedChunk.id;
                currentAiMessageId = messageId;
                dispatch(createAiMessage({ id: messageId }));
              }

              if (parsedChunk.content) {
                newAiResponse += parsedChunk.content;
              }

              // 处理 reasoning_content
              if (parsedChunk.additional_kwargs?.reasoning_content) {
                newReasoningContent += parsedChunk.additional_kwargs.reasoning_content as string;
              }

              // 有content或reasoning_content时立即更新，实现流式渲染
              if (currentAiMessageId) {
                const updateData: any = {
                  id: currentAiMessageId,
                  content: newAiResponse
                };
                if (newReasoningContent) {
                  updateData.reasoning_content = newReasoningContent;
                }
                dispatch(updateAiMessage(updateData));
              }

              if (parsedChunk.tool_call_chunks && parsedChunk.tool_call_chunks.length > 0) {
                for (const chunk of parsedChunk.tool_call_chunks) {
                  const index = chunk.index ?? 0;
                  if (!toolCallChunksMap.has(index)) {
                    toolCallChunksMap.set(index, { args: '' });
                  }
                  const existing = toolCallChunksMap.get(index)!;
                  if (chunk.name) {
                    (existing as any).name = chunk.name;
                  }
                  if (chunk.args) {
                    existing.args += chunk.args;
                  }
                  if (chunk.id !== null && chunk.id !== undefined) {
                    (existing as any).id = chunk.id;
                  }
                }

                const toolCalls: ToolCall[] = [];
                for (const [index, existing] of toolCallChunksMap.entries()) {
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

                processFileToolCalls(toolCalls);
              }
            }
          } catch (e) {
            console.log('无法解析chunk:', line);
          }
        }
      }

      // 重新生成完成后，刷新state
      const stateData = await httpClient.get('/api/chat/state');
      dispatch(setState(stateData));
    } catch (error) {
      console.error('重新生成消息失败:', error);
      setModal({ show: true, message: (error as Error).toString(), onConfirm: null, onCancel: null });
    } finally {
      dispatch(setIsStreaming(false));
    }
  };

  // 编辑消息 - 进入编辑模式
  const editMessage = (msgId: string, messageType: 'human' | 'ai', content: string) => {
    setEditingMessageId(msgId);
    setEditingMessageType(messageType);
    setEditingContent(content);
  };

  // 确认编辑并重新生成
  const confirmEdit = async (msgId: string, newContent: string, messageType: 'human' | 'ai') => {
    try {
      setEditingMessageId(null);
      setEditingContent('');
      dispatch(setIsStreaming(true));

      const response = await httpClient.streamRequest('/api/history/regenerate/stream', {
        method: 'POST',
        body: {
          thread_id: threadId,
          message_id: msgId,
          new_content: newContent,
          message_type: messageType
        }
      });

      if (!response.ok) {
        throw new Error('编辑并重新生成请求失败');
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('无法获取响应流');
      }

      const decoder = new TextDecoder();
      let currentAiMessageId: string | null = null;
      let newAiResponse = "";
      let newReasoningContent = "";
      const toolCallChunksMap = new Map<number, { name?: string; args: string; id?: string }>();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n').filter(line => line.trim() !== '');

        for (const line of lines) {
          try {
            const parsedChunk = JSON.parse(line) as StreamChunk;

            // 处理流式传输中断信号
            if (parsedChunk.interrupted) {
              console.log("编辑后重新生成被中断");
              dispatch(setIsStreaming(false));
              break;
            }

            if (parsedChunk.type === 'AIMessageChunk') {
              if (!currentAiMessageId && parsedChunk.id) {
                const messageId = parsedChunk.id;
                currentAiMessageId = messageId;
                dispatch(createAiMessage({ id: messageId }));
              }

              if (parsedChunk.content) {
                newAiResponse += parsedChunk.content;
              }

              // 处理 reasoning_content
              if (parsedChunk.additional_kwargs?.reasoning_content) {
                newReasoningContent += parsedChunk.additional_kwargs.reasoning_content as string;
              }

              // 有content或reasoning_content时立即更新，实现流式渲染
              if (currentAiMessageId) {
                const updateData: any = {
                  id: currentAiMessageId,
                  content: newAiResponse
                };
                if (newReasoningContent) {
                  updateData.reasoning_content = newReasoningContent;
                }
                dispatch(updateAiMessage(updateData));
              }

              if (parsedChunk.tool_call_chunks && parsedChunk.tool_call_chunks.length > 0) {
                for (const chunk of parsedChunk.tool_call_chunks) {
                  const index = chunk.index ?? 0;
                  if (!toolCallChunksMap.has(index)) {
                    toolCallChunksMap.set(index, { args: '' });
                  }
                  const existing = toolCallChunksMap.get(index)!;
                  if (chunk.name) {
                    (existing as any).name = chunk.name;
                  }
                  if (chunk.args) {
                    existing.args += chunk.args;
                  }
                  if (chunk.id !== null && chunk.id !== undefined) {
                    (existing as any).id = chunk.id;
                  }
                }

                const toolCalls: ToolCall[] = [];
                for (const [index, existing] of toolCallChunksMap.entries()) {
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

                processFileToolCalls(toolCalls);
              }
            }
          } catch (e) {
            console.log('无法解析chunk:', line);
          }
        }
      }

      // 编辑完成后，刷新state
      const stateData = await httpClient.get('/api/chat/state');
      dispatch(setState(stateData));
    } catch (error) {
      console.error('编辑消息失败:', error);
      setModal({ show: true, message: (error as Error).toString(), onConfirm: null, onCancel: null });
    } finally {
      dispatch(setIsStreaming(false));
    }
  };

  // 取消编辑
  const cancelEdit = () => {
    setEditingMessageId(null);
    setEditingContent('');
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

  // 渲染用户消息内容，高亮@文件路径
  const renderUserMessageContent = (content: string) => {
    if (!content) return null;
    
    // 匹配 @文件路径 的模式
    const parts = content.split(/(@[^\s\n]+)/g);
    
    return parts.map((part, index) => {
      if (part.startsWith('@') && part.length > 1) {
        // 这是文件路径引用，使用theme-gray3高亮
        return (
          <span key={index} className="text-theme-gray3">
            {part}
          </span>
        );
      }
      // 普通文本
      return <span key={index}>{part}</span>;
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
    const isToolResult = msg.type === 'tool';
    const isEditing = editingMessageId === msg.id;
    
    // 工具结果消息独立渲染
    if (isToolResult) {
      const isExpanded = expandedToolResults.has(msg.id);
      const previewContent = getPreviewContent(msg.content || '');
      
      return (
        <div
          key={msg.id}
          className="flex flex-col w-[80%] self-start bg-theme-gray1 border border-theme-green p-2.5 rounded-medium break-words overflow-wrap break-word"
        >
          <div className="flex items-center">
            <div className="flex items-center cursor-pointer" onClick={() => toggleToolResultExpand(msg.id)}>
              <FontAwesomeIcon icon={isExpanded ? faAngleUp : faAngleRight} className="text-theme-green hover:text-theme-white text-xs mr-2" />
              <span className="font-bold text-[0.9em] text-theme-white">工具</span>
            </div>
          </div>
          <div className="leading-[1.4] overflow-wrap break-word break-words text-theme-white mt-1">
            {isExpanded ? (
              <div className="whitespace-pre-wrap">{msg.content}</div>
            ) : (
              <div className="text-sm">{previewContent}</div>
            )}
          </div>
        </div>
      );
    }
    
    // 用户消息、AI消息
    const usageMetadata = msg.type === 'ai' ? (msg as AIMessage).usage_metadata : null;
    const inputTokens = usageMetadata?.input_tokens || 0;
    const outputTokens = usageMetadata?.output_tokens || 0;
    
    return (
      <div
        key={msg.id}
        className={`flex flex-col w-[80%] ${
          isUser ? 'self-end' : 'self-start'
        }`}
      >
        {/* 消息气泡 */}
        <div
          className={`flex flex-col w-full p-2.5 rounded-medium break-words overflow-wrap break-word ${
            isUser
              ? 'bg-theme-green1 text-theme-white'
              : 'bg-theme-gray2 text-theme-white'
          }`}
        >
          <div className="flex items-center justify-between mb-1">
            <div className="font-bold text-[0.9em]">
              {isEditing ? '编辑消息' : (isUser ? '用户' : 'AI')}
            </div>
          </div>
          <div className="leading-[1.4] overflow-wrap break-word break-words">
            {isEditing ? (
              <div className="flex flex-col gap-2">
                <textarea
                  className="w-full bg-theme-gray1 text-theme-white p-2 rounded-small border border-theme-gray3 focus:border-theme-green outline-none resize-none"
                  rows={6}
                  value={editingContent}
                  onChange={(e) => setEditingContent(e.target.value)}
                  autoFocus
                />
                <div className="flex justify-end gap-2">
                  <button
                    className="px-4 py-2 rounded-small bg-theme-gray3 text-theme-white hover:bg-theme-gray4 transition-colors"
                    onClick={cancelEdit}
                  >
                    取消
                  </button>
                  <button
                    className="px-4 py-2 rounded-small bg-theme-green text-theme-white hover:bg-theme-green1 transition-colors"
                    onClick={() => confirmEdit(msg.id, editingContent, isUser ? 'human' : 'ai')}
                  >
                    确定并重新生成
                  </button>
                </div>
              </div>
            ) : (
              <div>
                {isUser ? (
                  <div className="whitespace-pre-wrap">{renderUserMessageContent(msg.content || '')}</div>
                ) : (
                  <div>
                    {msg.type === 'ai' && Boolean((msg as AIMessage).additional_kwargs?.reasoning_content) && (
                      <div className="mt-2 p-2 bg-black/20 rounded-small">
                        <div className="flex items-center gap-2">
                          <FontAwesomeIcon
                            icon={expandedReasonings.has(msg.id) ? faAngleUp : faAngleRight}
                            className="text-xs text-theme-green cursor-pointer hover:text-theme-white"
                            onClick={() => toggleReasoningExpand(msg.id)}
                          />
                          <span className="font-bold text-theme-green">思维链</span>
                        </div>
                        {expandedReasonings.has(msg.id) && (
                          <div className="mt-1 text-[0.8em] text-theme-white whitespace-pre-wrap break-words">
                            {(msg as AIMessage).additional_kwargs.reasoning_content as string}
                          </div>
                        )}
                      </div>
                    )}
                    <div className="whitespace-pre-wrap">{msg.content}</div>
                    {msg.type === 'ai' && (msg as AIMessage).tool_calls && (msg as AIMessage).tool_calls.length > 0 && (
                      <div className="mt-2 p-2 bg-black/20 rounded-small">
                        {(msg as AIMessage).tool_calls.map((toolCall, toolIndex) => {
                          const toolKey = `${msg.id}-${toolIndex}`;
                          const isExpanded = !expandedTools.has(toolKey); // 默认展开（未在集合中即为展开）
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
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
        
        {/* 气泡下方的操作栏（编辑模式下隐藏） */}
        {!isEditing && (
          <div className="flex items-center justify-between mt-1 px-1">
            {/* 按钮组 */}
            <div className="flex gap-2">
              <button
                className="text-xs flex items-center gap-1 text-theme-gray3 hover:text-theme-green transition-colors"
                onClick={() => copyMessage(msg.content || '', msg.id)}
                title={copiedMessageId === msg.id ? "已复制" : "复制"}
              >
                <FontAwesomeIcon icon={copiedMessageId === msg.id ? faCheck : faCopy} />
              </button>
              {isUser && !isInterrupted && (
                <button
                  className="text-xs flex items-center gap-1 text-theme-gray3 hover:text-theme-green transition-colors"
                  onClick={() => regenerateMessage(msg.id, 'human')}
                  title="重新生成"
                >
                  <FontAwesomeIcon icon={faRotateRight} />
                </button>
              )}
              {!isInterrupted && (
                <button
                  className="text-xs flex items-center gap-1 text-theme-gray3 hover:text-theme-red transition-colors"
                  onClick={() => deleteMessage(msg.id)}
                  title="删除"
                >
                  <FontAwesomeIcon icon={faTrash} />
                </button>
              )}
              {!isInterrupted && (
                <button
                  className="text-xs flex items-center gap-1 text-theme-gray3 hover:text-theme-green transition-colors"
                  onClick={() => editMessage(msg.id, isUser ? 'human' : 'ai', msg.content || '')}
                  title="编辑"
                >
                  <FontAwesomeIcon icon={faEdit} />
                </button>
              )}
            </div>
            
            {/* 右侧上下文信息 */}
            {usageMetadata && (inputTokens > 0 || outputTokens > 0) && (
              <div className="text-xs text-theme-gray3">
                ↑ {inputTokens} ↓ {outputTokens}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex-1 overflow-y-auto p-2.5 flex flex-col relative">
      <div className="flex-1 overflow-y-auto mt-2.5 flex flex-col gap-2">
        {messages.map(renderMessage)}
        <div ref={messagesEndRef} />
      </div>
      {/* 模态框管理模块 */}
      {modal.show && (
        <UnifiedModal
          message={modal.message}
          buttons={[
            { text: '确定', onClick: modal.onConfirm || (() => setModal({ show: false, message: '', onConfirm: null, onCancel: null })), className: 'bg-theme-green' },
            { text: '取消', onClick: modal.onCancel || (() => setModal({ show: false, message: '', onConfirm: null, onCancel: null })), className: 'bg-theme-gray3' }
          ]}
        />
      )}
    </div>
  );
};

export default MessageDisplayPanel;
