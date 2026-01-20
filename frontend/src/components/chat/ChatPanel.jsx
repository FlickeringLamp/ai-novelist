import { useState, useRef, useEffect } from "react";
import ChatHistoryPanel from './header/ChatHistoryPanel.jsx'
import ModelSelectorPanel from './header/ModelSelectorPanel.jsx'
import ModeSelector from './input/ModeSelector'
import MessageInput from './input/MessageInput'
import MessageDisplay from './messagedisplay/MessageDisplay'
import AutoApproveConfig from './input/AutoApproveConfig'
import httpClient from '../../utils/httpClient.js'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFileLines, faPlus } from '@fortawesome/free-solid-svg-icons';

// 处理流式响应的辅助函数
const handleStreamResponse = (response) => {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  
  const decodeBase64Data = (base64String) => {
    try {
      const binaryString = atob(base64String);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const decodedString = new TextDecoder('utf-8').decode(bytes);
      return JSON.parse(decodedString);
    } catch (e) {
      console.error('Base64解码或JSON解析失败:', e);
      return null;
    }
  };
  
  return {
    async *[Symbol.asyncIterator]() {
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          buffer += decoder.decode(value, { stream: true });
          
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';
          
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6).trim();
              if (data === '') continue;
              
              try {
                const decodedData = decodeBase64Data(data);
                if (decodedData) {
                  yield decodedData;
                }
              } catch (e) {
                console.error('解码Base64数据失败:', e, '原始数据:', data);
              }
            }
          }
        }
        
        if (buffer.trim() && buffer.startsWith('data: ')) {
          const data = buffer.slice(6).trim();
          if (data !== '') {
            try {
              const decodedData = decodeBase64Data(data);
              if (decodedData) {
                yield decodedData;
              }
            } catch (e) {
              console.error('解码剩余Base64数据失败:', e, '原始数据:', data);
            }
          }
        }
      } finally {
        reader.releaseLock();
      }
    }
  };
};

const ChatPanel = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState([]);
  const [currentAiMessage, setCurrentAiMessage] = useState('');
  const [interruptInfo, setInterruptInfo] = useState(null);
  const [autoApproveSettings, setAutoApproveSettings] = useState({
    enabled: false,
    delay: 1000
  });
  const messagesEndRef = useRef(null);
  
  // 用于生成唯一ID的计数器
  const messageIdCounter = useRef(0);
  
  // 生成唯一消息ID的函数
  const generateMessageId = () => {
    messageIdCounter.current += 1;
    return `${Date.now()}_${messageIdCounter.current}`;
  };

  // 自动滚动到最新消息
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, currentAiMessage]);

  // 组件挂载时加载当前thread_id的历史消息
  useEffect(() => {
    const loadCurrentThreadMessages = async () => {
      try {
        const threadResponse = await httpClient.get('/api/chat/current-thread');
        if (threadResponse.success && threadResponse.thread_id) {
          const threadId = threadResponse.thread_id;
          console.log('加载当前thread_id的历史消息:', threadId);
          // 获取该thread_id的历史消息
          const messagesResult = await httpClient.post('/api/history/messages', {
            thread_id: threadId,
            mode: 'outline'
          });
          
          if (messagesResult.success && messagesResult.data && messagesResult.data.length > 0) {
            const messages = messagesResult.data;
            // 将消息转换为前端期望的格式
            const formattedMessages = messages.map(msg => {
              // 将后端消息类型转换为前端角色
              let role;
              if (msg.message_type === 'human') {
                role = 'user';
              } else if (msg.message_type === 'ai') {
                role = 'assistant';
              } else {
                role = msg.message_type; // 'tool' 或其他类型
              }
              
              return {
                id: msg.message_id || `msg_${msg.index}`,
                role: role,
                content: msg.content,
                tool_calls: msg.tool_calls
              };
            });
            
            // 检查最后一条消息是否是包含工具调用的AI消息
            const lastMessage = formattedMessages[formattedMessages.length - 1];
            if (lastMessage && lastMessage.role === 'assistant' && lastMessage.tool_calls && lastMessage.tool_calls.length > 0) {
              // 如果最后一条消息是包含工具调用的AI消息，需要将其转换为工具请求状态
              // 1. 将AI消息的内容和工具调用分开
              const aiMessage = {
                ...lastMessage,
                tool_calls: [] // AI消息本身不包含工具调用
              };
              
              // 2. 创建工具请求消息
              const toolRequestMessage = {
                id: generateMessageId(),
                role: 'tool_request',
                content: '',
                tool_calls: lastMessage.tool_calls
              };
              
              // 3. 替换最后一条消息并添加工具请求消息
              const updatedMessages = [...formattedMessages.slice(0, -1), aiMessage, toolRequestMessage];
              
              // 4. 设置中断信息以显示批准/拒绝按钮
              if (lastMessage.tool_calls.length > 0) {
                const toolCall = lastMessage.tool_calls[0];
                const toolInfo = {
                  id: `historic_tool_${Date.now()}`, // 创建一个唯一ID
                  tool_name: toolCall.name,
                  parameters: toolCall.args || {},
                  description: `历史工具调用: ${toolCall.name}`,
                  isHistoric: true // 标记这是历史工具调用
                };
                
                setInterruptInfo(toolInfo);
              }
              
              setMessages(updatedMessages);
            } else {
              setMessages(formattedMessages);
            }
            
            console.log(`已加载 ${formattedMessages.length} 条历史消息`);
          } else {
            console.log('当前thread_id没有历史消息或加载失败');
          }
        } else {
          console.log('获取当前thread_id失败');
        }
      } catch (error) {
        console.error('加载当前thread_id历史消息失败:', error);
      }
    };

    loadCurrentThreadMessages();
  }, []); // 只在组件挂载时执行一次

  const handleSendMessage = async (message) => {
    if (!message.trim()) return;
    
    // 添加用户消息到消息列表
    const userMessage = {
      id: generateMessageId(),
      role: 'user',
      content: message
    };
    
    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);
    setCurrentAiMessage('');
    
    try {
      // 构造消息数据
      const messageData = {
        message: message
      };
      
      const responseStream = await httpClient.streamRequest('/api/chat/message', {
        method: 'POST',
        body: { message: message }
      });
      
      const streamIterator = handleStreamResponse(responseStream);
      
      // 处理流式响应
      let aiResponse = '';
      let currentToolCalls = []; // 用于收集工具调用信息
      
      for await (const chunk of streamIterator) {
        
        // 检查是否是完成标记
        if (chunk && chunk.type === 'done') {
          break;
        }
        
        // 检查是否是错误
        if (chunk && chunk.error) {
          console.error('流式响应错误:', chunk.error);
          aiResponse = `错误: ${chunk.error}`;
          setCurrentAiMessage(aiResponse);
          break;
        }
        
        // 检查是否是中断信息
        if (chunk && chunk.type === 'interrupt') {
          
          // 从中断信息中提取工具信息
          let toolInfo = null;
          if (chunk.interrupts && chunk.interrupts.length > 0) {
            const interrupt = chunk.interrupts[0];
            if (interrupt.value && interrupt.value.tool_name) {
              toolInfo = interrupt.value;
              toolInfo.id = interrupt.id; // 添加中断ID
              
              // 创建工具请求消息
              const toolRequestMessage = {
                id: generateMessageId(),
                role: 'tool_request',
                content: '',
                tool_calls: [{
                  name: toolInfo.tool_name,
                  args: {
                    ...toolInfo.parameters,
                    // 对于 ask_user 工具，确保问题内容被包含在 args 中
                    ...(toolInfo.tool_name === 'ask_user' && toolInfo.question ? { question: toolInfo.question } : {})
                  }
                }]
              };
              
              // 添加工具请求消息到消息列表，并确保它默认折叠
              setMessages(prev => {
                const newMessages = [...prev, toolRequestMessage];
                // 触发MessageDisplay组件的useEffect来设置折叠状态
                return newMessages;
              });
            }
          }
          
          if (toolInfo) {
            // 对于 ask_user 工具，只传递必要的信息用于渲染按钮
            if (toolInfo.tool_name === 'ask_user') {
              setInterruptInfo({
                ...toolInfo,
                // 标记这是一个简化的中断信息，只用于渲染按钮
                isSimpleInterrupt: true
              });
            } else {
              setInterruptInfo(toolInfo);
            }
          } else {
            // 如果没有找到工具信息，使用原始中断信息
            setInterruptInfo(chunk);
          }
          
          // 暂停处理流式响应，等待用户处理中断
          break;
        }
        
        // 处理不同类型的消息
        if (chunk && chunk.type) {
          // 处理系统消息
          if (chunk.type === 'systemmessage') {
            const systemMessage = {
              id: generateMessageId(),
              role: 'system',
              content: chunk.content || ''
            };
            setMessages(prev => [...prev, systemMessage]);
          }
          // 处理工具消息
          else if (chunk.type === 'toolmessage') {
            const toolMessage = {
              id: generateMessageId(),
              role: 'tool',
              content: chunk.content || '',
              tool_calls: chunk.tool_calls || []
            };
            setMessages(prev => [...prev, toolMessage]);
          }
          // 处理AI消息内容
          else if (chunk.type === 'aimessagechunk' && chunk.content) {
            aiResponse += chunk.content;
            setCurrentAiMessage(aiResponse);
            
            // 检查是否有工具调用信息
            if (chunk.tool_calls && chunk.tool_calls.length > 0) {
              currentToolCalls = chunk.tool_calls;
            }
          }
          // 处理完整的AI消息（包含工具调用）
          else if (chunk.type === 'aimessage') {
            // 如果是完整的AI消息，直接使用其内容
            aiResponse = chunk.content || '';
            setCurrentAiMessage(aiResponse);
            
            // 如果有工具调用信息，保存它们
            if (chunk.tool_calls && chunk.tool_calls.length > 0) {
              currentToolCalls = chunk.tool_calls;
            }
          }
        }
      }
      
      // 流式响应完成后，将AI消息添加到消息列表
      // 先添加普通AI消息（如果有内容）
      if (aiResponse) {
        const aiMessage = {
          id: generateMessageId(),
          role: 'assistant',
          content: aiResponse,
          tool_calls: [] // 普通AI消息不包含工具调用
        };
        setMessages(prev => [...prev, aiMessage]);
      }
      
      // 然后添加工具请求消息（如果有工具调用）
      if (currentToolCalls.length > 0) {
        const toolRequestMessage = {
          id: generateMessageId(),
          role: 'tool_request', // 使用新的角色类型
          content: '', // 工具请求消息不需要正文内容
          tool_calls: currentToolCalls
        };
        setMessages(prev => [...prev, toolRequestMessage]);
      }
      
      // 立即清空当前AI消息，避免重复显示
      setCurrentAiMessage('');
    } catch (error) {
      console.error('发送消息失败:', error);
      // 添加错误消息
      const errorMessage = {
        id: generateMessageId(),
        role: 'assistant',
        content: '抱歉，发生了错误，请稍后再试。'
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  // 处理中断响应
  // 处理中断响应
  const handleInterruptResponse = async (response) => {
    console.log('处理中断响应:', response);
    
    try {
      // 检查是否是历史工具调用
      if (interruptInfo && interruptInfo.isHistoric) {
        // 对于历史工具调用，我们需要重新执行工具调用
        // 首先找到对应的工具请求消息
        const toolRequestMessage = messages.find(msg =>
          msg.role === 'tool_request' &&
          msg.tool_calls &&
          msg.tool_calls.length > 0 &&
          msg.tool_calls[0].name === interruptInfo.tool_name
        );
        
        if (toolRequestMessage && response.action === 'approve') {
          // 如果用户批准，则重新执行工具调用
          try {
            // 创建一个新的中断响应，模拟原始工具调用
            const newInterruptResponse = {
              interruptId: `historic_${Date.now()}`,
              choice: '1', // '1'=恢复
              additionalData: response.additionalData || ''
            };
            
            const responseStream = await httpClient.streamRequest('/api/chat/interrupt-response', {
              method: 'POST',
              body: {
                interrupt_id: newInterruptResponse.interruptId,
                choice: newInterruptResponse.choice,
                additional_data: newInterruptResponse.additionalData
              }
            });
            
            const streamIterator = handleStreamResponse(responseStream);
            
            // 清除中断信息
            setInterruptInfo(null);
            
            // 处理响应流
            await processStreamResponse(streamIterator);
          } catch (error) {
            console.error('执行历史工具调用失败:', error);
            // 添加错误消息
            const errorMessage = {
              id: generateMessageId(),
              role: 'assistant',
              content: `执行历史工具调用失败: ${error.message}`
            };
            setMessages(prev => [...prev, errorMessage]);
            setInterruptInfo(null);
          }
        } else {
          // 如果用户拒绝，只清除中断信息
          setInterruptInfo(null);
          
          // 添加拒绝消息
          const rejectMessage = {
            id: generateMessageId(),
            role: 'assistant',
            content: `已拒绝执行工具: ${interruptInfo.tool_name}`
          };
          setMessages(prev => [...prev, rejectMessage]);
        }
        return;
      }
      
      // 发送中断响应到后端
      const interruptResponse = {
        interruptId: interruptInfo.id,
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
      });
      
      const streamIterator = handleStreamResponse(responseStream);
      
      // 清除中断信息
      setInterruptInfo(null);
      
      // 处理响应流
      await processStreamResponse(streamIterator);
    } catch (error) {
      console.error('处理中断响应失败:', error);
      // 清除中断信息
      setInterruptInfo(null);
      // 添加错误消息
      const errorMessage = {
        id: generateMessageId(),
        role: 'assistant',
        content: '抱歉，处理中断响应时发生错误，请稍后再试。'
      };
      setMessages(prev => [...prev, errorMessage]);
    }
  };
  
  // 处理流式响应的辅助函数
  const processStreamResponse = async (responseStream) => {
    // 处理中断响应的流式响应
    let aiResponse = '';
    let currentToolCalls = []; // 用于收集工具调用信息
    
    for await (const chunk of responseStream) {
      
      // 检查是否是完成标记
      if (chunk && chunk.type === 'done') {
        break;
      }
      
      // 检查是否是错误
      if (chunk && chunk.error) {
        console.error('中断响应流式错误:', chunk.error);
        aiResponse = `错误: ${chunk.error}`;
        setCurrentAiMessage(aiResponse);
        break;
      }
      
      // 检查是否是再次中断
      if (chunk && chunk.type === 'interrupt') {
        console.log('收到再次中断信息:', chunk);
        
        // 从中断信息中提取工具信息
        let toolInfo = null;
        if (chunk.interrupts && chunk.interrupts.length > 0) {
          const interrupt = chunk.interrupts[0];
          if (interrupt.value && interrupt.value.tool_name) {
            toolInfo = interrupt.value;
            toolInfo.id = interrupt.id; // 添加中断ID
            
            // 创建工具请求消息
            const toolRequestMessage = {
              id: generateMessageId(),
              role: 'tool_request',
              content: '',
              tool_calls: [{
                name: toolInfo.tool_name,
                args: {
                  ...toolInfo.parameters,
                  // 对于 ask_user 工具，确保问题内容被包含在 args 中
                  ...(toolInfo.tool_name === 'ask_user' && toolInfo.question ? { question: toolInfo.question } : {})
                }
              }]
            };
            
            // 添加工具请求消息到消息列表，并确保它默认折叠
            setMessages(prev => {
              const newMessages = [...prev, toolRequestMessage];
              // 触发MessageDisplay组件的useEffect来设置折叠状态
              return newMessages;
            });
          }
        }
        
        if (toolInfo) {
          // 对于 ask_user 工具，只传递必要的信息用于渲染按钮
          if (toolInfo.tool_name === 'ask_user') {
            setInterruptInfo({
              ...toolInfo,
              // 标记这是一个简化的中断信息，只用于渲染按钮
              isSimpleInterrupt: true
            });
          } else {
            setInterruptInfo(toolInfo);
          }
        } else {
          // 如果没有找到工具信息，使用原始中断信息
          setInterruptInfo(chunk);
        }
        
        // 暂停处理流式响应，等待用户处理中断
        break;
      }
      
      // 处理不同类型的消息
      if (chunk && chunk.type) {
        // 处理系统消息
        if (chunk.type === 'systemmessage') {
          const systemMessage = {
            id: generateMessageId(),
            role: 'system',
            content: chunk.content || ''
          };
          setMessages(prev => [...prev, systemMessage]);
        }
        // 处理工具消息
        else if (chunk.type === 'toolmessage') {
          const toolMessage = {
            id: generateMessageId(),
            role: 'tool',
            content: chunk.content || '',
            tool_calls: chunk.tool_calls || []
          };
          setMessages(prev => [...prev, toolMessage]);
        }
        // 处理AI消息内容
        else if (chunk.type === 'aimessagechunk' && chunk.content) {
          aiResponse += chunk.content;
          setCurrentAiMessage(aiResponse);
          
          // 检查是否有工具调用信息
          if (chunk.tool_calls && chunk.tool_calls.length > 0) {
            currentToolCalls = chunk.tool_calls;
          }
        }
        // 处理完整的AI消息（包含工具调用）
        else if (chunk.type === 'aimessage') {
          // 如果是完整的AI消息，直接使用其内容
          aiResponse = chunk.content || '';
          setCurrentAiMessage(aiResponse);
          
          // 如果有工具调用信息，保存它们
          if (chunk.tool_calls && chunk.tool_calls.length > 0) {
            currentToolCalls = chunk.tool_calls;
          }
        }
      }
    }
    
    // 流式响应完成后，将AI消息添加到消息列表
    // 先添加普通AI消息（如果有内容）
    if (aiResponse) {
      const aiMessage = {
        id: generateMessageId(),
        role: 'assistant',
        content: aiResponse,
        tool_calls: [] // 普通AI消息不包含工具调用
      };
      setMessages(prev => [...prev, aiMessage]);
    }
    
    // 然后添加工具请求消息（如果有工具调用）
    if (currentToolCalls.length > 0) {
      const toolRequestMessage = {
        id: generateMessageId(),
        role: 'tool_request', // 使用新的角色类型
        content: '', // 工具请求消息不需要正文内容
        tool_calls: currentToolCalls
      };
      setMessages(prev => [...prev, toolRequestMessage]);
    }
    
    // 立即清空当前AI消息，避免重复显示
    setCurrentAiMessage('');
  };

  // 处理加载历史消息的回调函数
  const handleLoadHistory = (historyMessages) => {
    console.log('ChatPanel接收到历史消息:', historyMessages);
    
    // 检查最后一条消息是否是包含工具调用的AI消息
    const lastMessage = historyMessages[historyMessages.length - 1];
    let finalMessages = historyMessages;
    
    if (lastMessage && lastMessage.role === 'assistant' && lastMessage.tool_calls && lastMessage.tool_calls.length > 0) {
      // 如果最后一条消息是包含工具调用的AI消息，需要将其转换为工具请求状态
      // 1. 将AI消息的内容和工具调用分开
      const aiMessage = {
        ...lastMessage,
        tool_calls: [] // AI消息本身不包含工具调用
      };
      
      // 2. 创建工具请求消息
      const toolRequestMessage = {
        id: `load_history_tool_${Date.now()}`, // 创建一个唯一ID
        role: 'tool_request',
        content: '',
        tool_calls: lastMessage.tool_calls
      };
      
      // 3. 替换最后一条消息并添加工具请求消息
      finalMessages = [...historyMessages.slice(0, -1), aiMessage, toolRequestMessage];
      
      // 4. 设置中断信息以显示批准/拒绝按钮
      if (lastMessage.tool_calls.length > 0) {
        const toolCall = lastMessage.tool_calls[0];
        const toolInfo = {
          id: `load_history_interrupt_${Date.now()}`, // 创建一个唯一ID
          tool_name: toolCall.name,
          parameters: toolCall.args || {},
          description: `历史工具调用: ${toolCall.name}`,
          isHistoric: true // 标记这是历史工具调用
        };
        
        setInterruptInfo(toolInfo);
      }
    }
    
    setMessages(finalMessages);
  };

  // 处理创建新会话
  const handleCreateNewThread = async () => {
    try {
      const response = await httpClient.post('/api/chat/new-thread');
      
      if (response.success) {
        // 清空消息面板
        setMessages([]);
        setCurrentAiMessage('');
        setInterruptInfo(null);
        console.log('新会话创建成功:', response.thread_id);
      }
    } catch (error) {
      console.error('创建新会话失败:', error);
    }
  };

  // 处理总结对话
  const handleSummarizeConversation = async () => {
    try {
      setIsLoading(true);
      
      const response = await httpClient.post('/api/chat/summarize');
      
      if (response.success && response.summary) {
        // 创建总结消息
        const summaryMessage = {
          id: generateMessageId(),
          role: 'summary',
          content: response.summary,
          isCollapsible: true // 标记为可折叠的消息
        };
        
        // 添加总结消息到消息列表
        setMessages(prev => [...prev, summaryMessage]);
        
        console.log('对话总结成功:', response.summary);
      } else {
        // 添加错误消息
        const errorMessage = {
          id: generateMessageId(),
          role: 'assistant',
          content: response.message || '总结失败，请稍后再试。'
        };
        setMessages(prev => [...prev, errorMessage]);
      }
    } catch (error) {
      console.error('总结对话失败:', error);
      // 添加错误消息
      const errorMessage = {
        id: generateMessageId(),
        role: 'assistant',
        content: '总结对话时发生错误，请稍后再试。'
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };
// 处理自动批准设置变更
const handleAutoApproveSettingsChange = (newSettings) => {
  setAutoApproveSettings(newSettings);
};

return(
  <div className="flex flex-col h-full">
    <div className="flex justify-center items-center p-2.5 border-b border-theme-gray1 gap-10">
      <ChatHistoryPanel onLoadHistory={handleLoadHistory} />
      <ModelSelectorPanel />
      <button
        className="bg-theme-black text-theme-white rounded-full w-[30px] h-[30px] text-lg font-bold flex items-center justify-center hover:text-theme-green disabled:bg-theme-gray1 disabled:cursor-not-allowed disabled:opacity-60"
        onClick={handleSummarizeConversation}
        disabled={isLoading}
        title="总结对话"
      >
        <FontAwesomeIcon icon={faFileLines} />
      </button>
      <button
        className="bg-theme-black text-theme-white rounded-full w-[30px] h-[30px] text-lg font-bold flex items-center justify-center hover:bg-theme-green"
        onClick={handleCreateNewThread}
        title="创建新会话"
      >
        <FontAwesomeIcon icon={faPlus} />
      </button>
    </div>
    
    <div className="flex-1 overflow-y-auto p-2.5 flex flex-col">
      {/* 消息显示区域 */}
      <div className="flex-1 overflow-y-auto mt-2.5">
        <MessageDisplay messages={messages} currentAiMessage={currentAiMessage} isLoading={isLoading} />
        
        {/* 用于自动滚动到底部的元素 */}
        <div ref={messagesEndRef} />
      </div>
    </div>
    <div className="h-[15%] p-2.5 border-t border-theme-gray1">
      <MessageInput
        onSendMessage={handleSendMessage}
        disabled={isLoading}
        interruptInfo={interruptInfo}
        onInterruptResponse={handleInterruptResponse}
        autoApproveSettings={autoApproveSettings}
      />
    </div>
    
    <div className="flex gap-2.5 p-2.5 border-t border-theme-gray1 relative">
      <ModeSelector />
      <AutoApproveConfig onSettingsChange={handleAutoApproveSettingsChange} />
    </div>
  </div>
);
}

export default ChatPanel;