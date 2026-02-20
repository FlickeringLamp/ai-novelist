import type { ToolCall, StreamChunk, InterruptResponse } from '../types/langgraph';
import httpClient from './httpClient';
import { tryCompleteJSON } from './jsonUtils';
import { createAiMessage, updateAiMessage, setState, setMessage, clearInterrupt } from '../store/chat';
import type { Dispatch } from '@reduxjs/toolkit';
import { exitDiffMode, saveTabContent, decreaseTab } from '../store/editor';
import { FILE_TOOLS } from './fileToolHandler';

// 处理中断响应的共享函数
export const handleInterruptResponse = async (
  dispatch: Dispatch<any>,
  interrupt: any,
  response: InterruptResponse,
  processFileToolCalls: (toolCalls: ToolCall[]) => void
) => {
  console.log('处理中断响应:', response);
  
  try {
    const interruptResponse = {
      interruptId: interrupt.id,
      choice: response.choice || (response.action === 'approve' ? '1' : '2'),
      additionalData: response.additionalData || ''
    };
    
    // 处理所有文件工具的差异对比模式
    const toolName = interrupt?.value?.tool_name;
    if (toolName && FILE_TOOLS.includes(toolName)) {
      const path = interrupt.value.parameters?.path as string | undefined;
      if (path) {
        // 关闭差异对比模式
        dispatch(exitDiffMode({ id: path }));
        
        if (response.action === 'approve') {
          // 批准：同步 currentData 到 backUp
          dispatch(saveTabContent({ id: path }));
          
          // 如果是删除文件操作（write_file 且 content 为 null），需要关闭标签页
          const content = interrupt.value.parameters?.content;
          if (toolName === 'write_file' && content === null) {
            dispatch(decreaseTab({ tabId: path }));
          }
        } else {
          // 拒绝：关闭标签栏里的标签
          dispatch(decreaseTab({ tabId: path }));
        }
      }
    }
    
    // 立即清除中断，关闭操作栏
    dispatch(clearInterrupt());
    
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
          } else if (parsedChunk.type === 'tool') {
            console.log('收到ToolMessage，刷新文件树');
            try {
              const { setChapters } = await import('../store/file');
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
      console.log("获取最终状态成功，",finalState);
    } catch (error) {
      console.error('获取最终状态失败:', error);
    }
  } catch (error) {
    console.error('处理中断响应失败:', error);
  }
};
