import type { ToolCall, StreamChunk, InterruptResponse } from '../types/langgraph';
import httpClient from './httpClient';
import wsClient from './wsClient';
import { tryCompleteJSON } from './jsonUtils';
import { createAiMessage, updateAiMessage, setState, setMessage, clearInterrupt, setIsStreaming, addUserMessage, addToolMessage } from '../store/chat';
import type { Dispatch } from '@reduxjs/toolkit';
import { exitDiffMode, saveTabContent, decreaseTab, clearAiSuggestContent } from '../store/editor';
import { FILE_TOOLS } from './fileToolHandler';
import { computeDiff, hasDiff } from './diffUtils';
import type { RootState } from '../types';

// 处理中断响应的共享函数
export const handleInterruptResponse = async (
  dispatch: Dispatch<any>,
  interrupt: any,
  response: InterruptResponse,
  processFileToolCalls: (toolCalls: ToolCall[]) => void,
  currentData?: Record<string, string>,
  aiSuggestContent?: Record<string, string>
) => {
  console.log('处理中断响应:', response);
  
  try {
    // 处理所有文件工具的差异对比模式，计算用户diff
    const toolName = interrupt?.value?.tool_name;
    let userDiff: string | null = null;
    
    if (toolName && FILE_TOOLS.includes(toolName)) {
      const path = interrupt.value.parameters?.path as string | undefined;
      if (path && currentData && aiSuggestContent) {
        const aiContent = aiSuggestContent[path];
        const currentContent = currentData[path];
        
        // 关闭差异对比模式
        dispatch(exitDiffMode({ id: path }));
        
        if (response.action === 'approve') {
          // 批准：计算用户diff（如果有修改）
          if (aiContent !== undefined && currentContent !== undefined && hasDiff(aiContent, currentContent)) {
            userDiff = computeDiff(aiContent, currentContent);
            console.log('用户修改了AI建议内容，diff:', userDiff);
          }
          
          // 同步 currentData 到 backUp
          dispatch(saveTabContent({ id: path }));
          
          // 处理删除文件操作（manage_file 且 content 为 null）
          const content = interrupt.value.parameters?.content;
          if (toolName === 'manage_file' && content === null) {
            dispatch(decreaseTab({ tabId: path }));
          }
        } else {
          // 拒绝：关闭标签栏里的标签，不计算diff
          dispatch(decreaseTab({ tabId: path }));
        }
        
        // 清除AI建议内容
        dispatch(clearAiSuggestContent({ id: path }));
        
        // 无论批准还是拒绝，都刷新文件树以清理乐观更新的临时状态
        wsClient.send('subscribe_file_changes', {});
      }
    }
    
    const interruptResponse = {
      interruptId: interrupt.id,
      choice: response.choice || (response.action === 'approve' ? '1' : '2'),
      additionalData: response.additionalData || '',
      user_diff: userDiff || undefined  // 如果有用户diff，一并发送
    };
    
    if (response.additionalData && response.additionalData.trim()) {
      dispatch(addUserMessage({
        id: `temp-human-${Date.now()}`,
        content: response.additionalData
      }));
    }

    // 立即清除中断，关闭操作栏
    dispatch(clearInterrupt());

    // 开始流式传输
    dispatch(setIsStreaming(true));

    const responseStream = await httpClient.streamRequest('/api/chat/interrupt-response', {
      method: 'POST',
      body: {
        interrupt_id: interruptResponse.interruptId,
        choice: interruptResponse.choice,
        additional_data: interruptResponse.additionalData,
        user_diff: interruptResponse.user_diff
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
          // console.log("解析后的数据：", parsedChunk);

          // 处理流式传输中断信号
          if (parsedChunk.interrupted) {
            console.log("流式传输已被中断");
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
                // 当null/undefined/""时，避免覆盖
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

              // 立即处理文件工具调用
                processFileToolCalls(toolCalls);
              }
            }
        } catch (e) {
          console.log('无法解析chunk:', line);
        }
      }
    }
    
    // 流式传输结束，清除状态
    dispatch(setIsStreaming(false));
    
    // 获取最终状态
    try {
      const finalState = await httpClient.get('/api/chat/state');
      dispatch(setState(finalState));
      console.log("获取最终状态成功，",finalState);
    } catch (error) {
      console.error('获取最终状态失败:', error);
    }
  } catch (error) {
    console.error('处理中断响应失败:', error);
  }
};

/**
 * 注册WebSocket工具结果处理器
 * 用于接收后端推送的工具执行结果并临时显示
 */
export const registerToolResultHandler = (dispatch: Dispatch<any>) => {
  wsClient.onMessage((message: any) => {
    if (message.type === 'tool_result') {
      const { tool_call_id, tool_name, result } = message.payload;
      console.log('收到工具结果:', tool_name, result);

      // 临时添加工具消息到消息列表
      dispatch(addToolMessage({
        id: `temp-tool-${tool_call_id}`,
        content: result,
        tool_call_id: tool_call_id,
        name: tool_name
      }));
    }
  });
};
