import React, { useState, useEffect } from 'react';
import './MessageDisplay.css';
import ReactMarkdownMessageRenderer from './ReactMarkdownMessageRenderer.jsx';

const MessageDisplay = ({ messages, currentAiMessage, isLoading }) => {
  // 为每个工具消息、系统消息和工具请求消息创建折叠状态
  const [collapsedTools, setCollapsedTools] = useState({});
  
  // 当消息列表更新时，初始化工具消息、系统消息和工具请求消息的折叠状态
  useEffect(() => {
    const newCollapsedTools = { ...collapsedTools };
    let hasChanges = false;
    
    messages.forEach((msg, index) => {
      const messageId = msg.id || `msg_${index}`;
      // 如果是工具消息、系统消息、工具请求消息或总结消息且尚未设置折叠状态，则默认折叠
      if ((msg.role === 'tool' || msg.role === 'system' || msg.role === 'tool_request' || msg.role === 'summary') && newCollapsedTools[messageId] === undefined) {
        // 检查是否是 ask_user 工具请求，如果是则默认展开
        const isAskUserTool = msg.role === 'tool_request' &&
                             msg.tool_calls &&
                             msg.tool_calls.length > 0 &&
                             msg.tool_calls[0].name === 'ask_user';
        
        // 总结消息默认折叠，ask_user 工具默认展开，其他默认折叠
        newCollapsedTools[messageId] = msg.role === 'summary' ? true : !isAskUserTool;
        hasChanges = true;
      }
    });
    
    if (hasChanges) {
      setCollapsedTools(newCollapsedTools);
    }
  }, [messages]);
  // 切换工具消息、系统消息、工具请求消息和总结消息的折叠状态
  const toggleToolCollapse = (messageId) => {
    setCollapsedTools(prev => ({
      ...prev,
      [messageId]: !prev[messageId]
    }));
  };
  
  return (
    <div className="simple-message-display">
      {messages.map((msg, index) => {
        const isUser = msg.role === 'user';
        const isSystem = msg.role === 'system';
        const isTool = msg.role === 'tool';
        const isSummary = msg.role === 'summary';
        const content = msg.content || msg.text || '';
        const messageId = msg.id || `msg_${index}`;
        const isCollapsed = (isTool || isSystem || msg.role === 'tool_request' || isSummary) && collapsedTools[messageId];
        
        return (
          <div key={messageId} className={`simple-message ${isUser ? 'user-message' : isSystem ? 'system-message' : isTool ? 'tool-message' : msg.role === 'tool_request' ? 'tool-request-message' : isSummary ? 'summary-message' : 'ai-message'}`}>
            <div className="message-sender">
              {isUser ? '用户' : isSystem ? '系统' : isTool ? '工具' : msg.role === 'tool_request' ? '工具请求' : isSummary ? '📝 对话总结' : 'AI'}
            </div>
            <div className="message-content">
              {isUser ? (
                // 用户消息使用简单文本显示
                <div style={{ whiteSpace: 'pre-wrap' }}>{content}</div>
              ) : isSystem ? (
                // 系统消息使用折叠功能
                <div className="tool-message-container">
                  <div className="tool-message-header" onClick={() => toggleToolCollapse(messageId)}>
                    <span className="tool-toggle-icon">{isCollapsed ? '▶' : '▼'}</span>
                    <span className={`tool-message-preview ${isCollapsed ? 'collapsed' : ''}`}>
                      {isCollapsed ? content : content}
                    </span>
                  </div>
                </div>
              ) : isTool ? (
                // 工具消息使用折叠功能
                <div className="tool-message-container">
                  <div className="tool-message-header" onClick={() => toggleToolCollapse(messageId)}>
                    <span className="tool-toggle-icon">{isCollapsed ? '▶' : '▼'}</span>
                    <span className={`tool-message-preview ${isCollapsed ? 'collapsed' : ''}`}>
                      {isCollapsed ? content : content}
                    </span>
                  </div>
                  {!isCollapsed && msg.tool_calls && msg.tool_calls.length > 0 && (
                    <div className="tool-calls-info">
                      <div className="tool-calls-title">调用的工具:</div>
                      {msg.tool_calls.map((toolCall, toolIndex) => (
                        <div key={toolIndex} className="tool-call-item">
                          <span className="tool-name">{toolCall.name || toolCall.function?.name || '未知工具'}</span>
                          {toolCall.function?.arguments && (
                            <div className="tool-arguments">
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
                <div className="tool-message-container">
                  <div className="tool-message-header" onClick={() => toggleToolCollapse(messageId)}>
                    <span className="tool-toggle-icon">{isCollapsed ? '▶' : '▼'}</span>
                    <span className={`tool-message-preview ${isCollapsed ? 'collapsed' : ''}`}>
                      {isCollapsed ? (
                        // 折叠状态下显示工具名称或问题预览
                        (() => {
                          if (msg.tool_calls && msg.tool_calls.length > 0) {
                            const toolCall = msg.tool_calls[0];
                            const toolName = toolCall.name || toolCall.function?.name || '未知工具';
                            
                            // 对于 ask_user 工具，尝试显示问题内容
                            if (toolName === 'ask_user') {
                              // 从参数中获取问题内容
                              let question = '询问用户';
                              if (toolCall.args && toolCall.args.question) {
                                question = toolCall.args.question;
                              } else if (toolCall.function && toolCall.function.arguments) {
                                try {
                                  const args = typeof toolCall.function.arguments === 'string'
                                    ? JSON.parse(toolCall.function.arguments)
                                    : toolCall.function.arguments;
                                  if (args.question) {
                                    question = args.question;
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
                        })()
                      ) : (
                        // 展开状态下显示工具请求
                        `工具请求 (${msg.tool_calls.length}个工具)`
                      )}
                    </span>
                  </div>
                  {!isCollapsed && (
                    <div className="tool-calls-info">
                      <div className="tool-calls-title">工具请求:</div>
                      {msg.tool_calls.map((toolCall, toolIndex) => (
                        <div key={toolIndex} className="tool-call-item">
                          <span className="tool-name">{toolCall.name || toolCall.function?.name || '未知工具'}</span>
                          {toolCall.args && (
                            <div className="tool-arguments">
                              参数: {JSON.stringify(toolCall.args, null, 2)}
                            </div>
                          )}
                          {toolCall.function?.arguments && (
                            <div className="tool-arguments">
                              参数: {JSON.stringify(JSON.parse(toolCall.function.arguments), null, 2)}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : isSummary ? (
                // 总结消息使用折叠功能
                <div className="tool-message-container">
                  <div className="tool-message-header" onClick={() => toggleToolCollapse(messageId)}>
                    <span className="tool-toggle-icon">{isCollapsed ? '▶' : '▼'}</span>
                    <span className={`tool-message-preview ${isCollapsed ? 'collapsed' : ''}`}>
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
                    <div className="summary-content">
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
        <div className="simple-message ai-message">
          <div className="message-sender">AI</div>
          <div className="message-content">
            <ReactMarkdownMessageRenderer value={currentAiMessage} />
            {isLoading && <span className="typing-indicator">...</span>}
          </div>
        </div>
      )}
    </div>
  );
};

export default MessageDisplay;