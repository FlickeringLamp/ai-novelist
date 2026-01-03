import React, { useState, useRef, useEffect } from 'react';
import './MessageInput.css';
import FileListPopup from './FileListPopup.jsx';
import httpClient from '../../../utils/httpClient.js';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPaperPlane } from '@fortawesome/free-solid-svg-icons';

const MessageInput = ({ onSendMessage, interruptInfo, onInterruptResponse, disabled, autoApproveSettings }) => {
  const [message, setMessage] = useState('');
  const [showFileList, setShowFileList] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [fileReferences, setFileReferences] = useState([]); // 存储文件引用
  const textareaRef = useRef(null);
  const containerRef = useRef(null);

  // 检查是否应该显示文件列表
  const checkForAtTrigger = (text, cursorPosition) => {
    // 找到光标前最近的"@"符号
    const textBeforeCursor = text.substring(0, cursorPosition);
    const atIndex = textBeforeCursor.lastIndexOf('@');
    
    // 检查"@"后面是否跟着空格
    if (atIndex !== -1 && atIndex + 1 < textBeforeCursor.length && textBeforeCursor[atIndex + 1] === ' ') {
      // 提取搜索查询（"@"空格后的内容）
      const query = textBeforeCursor.substring(atIndex + 2).trim();
      return { shouldShow: true, atIndex, query };
    }
    return { shouldShow: false };
  };
  // 自动批准逻辑
  useEffect(() => {
    if (interruptInfo && autoApproveSettings.enabled) {
      const delay = autoApproveSettings.delay || 1000; // 默认1秒
      
      const autoApproveTimeout = setTimeout(() => {
        // 获取当前输入框的内容
        const currentMessage = message;
        
        // 立即清空输入框，提供即时反馈
        setMessage('');
        
        // 调用父组件的中断响应处理函数
        if (onInterruptResponse) {
          onInterruptResponse({
            action: 'approve',
            choice: '1', // '1'=恢复
            additionalData: currentMessage
          });
        }
      }, delay);
      
      return () => {
        clearTimeout(autoApproveTimeout);
      };
    }
  }, [interruptInfo, autoApproveSettings.enabled, autoApproveSettings.delay, message, onInterruptResponse]);

  // 处理文本变化
  const handleChange = (e) => {
    const newText = e.target.value;
    const cursorPosition = e.target.selectionStart;
    setMessage(newText);
    
    const { shouldShow, atIndex, query } = checkForAtTrigger(newText, cursorPosition);
    
    if (shouldShow) {
      setShowFileList(true);
      setSearchQuery(query);
    } else {
      setShowFileList(false);
      setSearchQuery('');
    }
  };

  // 处理键盘事件
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    } else if (e.key === 'Escape') {
      // ESC键关闭文件列表
      setShowFileList(false);
    }
  };

  // 处理表单提交
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (message.trim()) {
      // 处理文件引用，将@文件名替换为实际文件内容
      let processedMessage = message;
      const fileContentPromises = [];
      
      // 找到所有文件引用
      const fileRefPattern = /@ ([^@\n]+)/g;
      let match;
      const fileRefs = [];
      
      while ((match = fileRefPattern.exec(message)) !== null) {
        const fileName = match[1].trim();
        fileRefs.push(fileName);
        // 获取文件内容
        fileContentPromises.push(
          httpClient.get(`/api/file/read/${encodeURIComponent(fileName)}`)
            .then(response => {
              return { fileName, content: response };
            })
            .catch(error => {
              console.error(`读取文件 ${fileName} 失败:`, error);
              return { fileName, content: `[文件读取失败: ${fileName}]` };
            })
        );
      }
      
      // 等待所有文件内容加载完成
      if (fileContentPromises.length > 0) {
        try {
          const fileContents = await Promise.all(fileContentPromises);
          
          // 替换消息中的文件引用为实际内容
          fileContents.forEach(({ fileName, content }) => {
            processedMessage = processedMessage.replace(
              new RegExp(`@ ${fileName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'g'),
              content
            );
          });
        } catch (error) {
          console.error('处理文件内容时出错:', error);
        }
      }
      
      onSendMessage(processedMessage);
      setMessage('');
      setFileReferences([]);
    }
  };

  // 处理文件选择
  const handleFileSelect = async (file) => {
    // 获取光标位置
    const cursorPosition = textareaRef.current.selectionStart;
    const textBeforeCursor = message.substring(0, cursorPosition);
    const textAfterCursor = message.substring(cursorPosition);
    
    // 找到"@"的位置
    const atIndex = textBeforeCursor.lastIndexOf('@');
    
    // 使用完整路径而不是仅文件名
    // 替换"@"和空格为"@完整路径"
    const newMessage =
      textBeforeCursor.substring(0, atIndex) +
      `@${file}` +
      textAfterCursor;
    
    setMessage(newMessage);
    setShowFileList(false);
    
    // 将光标设置到文件路径后
    setTimeout(() => {
      const newCursorPosition = atIndex + file.length + 1;
      textareaRef.current.focus();
      textareaRef.current.setSelectionRange(newCursorPosition, newCursorPosition);
    }, 0);
    
    // 添加到文件引用列表
    setFileReferences(prev => [...prev, file]);
  };

  // 关闭文件列表
  const handleCloseFileList = () => {
    setShowFileList(false);
  };

  // 处理中断响应
  const handleToolActionResponse = async (action) => {
    try {
      // 获取当前输入框的内容
      const currentMessage = message;
      
      // 立即清空输入框，提供即时反馈
      setMessage('');
      
      // 调用父组件的中断响应处理函数，传递用户输入的额外信息
      if (onInterruptResponse) {
        await onInterruptResponse({
          action: action,
          choice: action === 'approve' ? '1' : '2', // '1'=恢复, '2'=取消
          additionalData: currentMessage
        });
      }
    } catch (error) {
      console.error('MessageInput: 处理中断响应失败:', error);
    }
  };

  const handleApprove = () => {
    handleToolActionResponse('approve');
  };

  const handleReject = () => {
    handleToolActionResponse('reject');
  };

  // 格式化中断信息显示
  const formatInterruptDisplay = () => {
    // 使用新的中断信息格式
    const { tool_name, tool_display_name, description, id } = interruptInfo;
    
    // 简化工具名称和描述
    let toolName = tool_display_name || tool_name || '工具调用';
    let displayText = description || '工具调用请求';
    
    // 简化显示格式
    if (toolName === 'read_file' && displayText.startsWith('读取文件: ')) {
      const fileName = displayText.replace('读取文件: ', '');
      toolName = '读取';
      displayText = fileName;
    } else if (toolName === 'write_file' && displayText.startsWith('写入文件: ')) {
      const fileName = displayText.split(' ')[0].replace('写入文件:', '');
      toolName = '写入';
      displayText = fileName;
    } else if (toolName === 'search_files' && displayText.startsWith('搜索文件: ')) {
      const parts = displayText.split(' ');
      const path = parts[2];
      toolName = '搜索';
      displayText = path;
    } else if (toolName === 'ask_user' || toolName === '询问用户') {
      toolName = '询问';
      // 对于 ask_user 工具，直接显示问题内容，去掉"请回复:"前缀
      if (displayText.startsWith('请回复: ')) {
        displayText = displayText.replace('请回复: ', '');
      }
    }
    
    return {
      toolName,
      displayText,
      interruptId: id
    };
  };
  // 如果有中断信息，显示工具调用请求
  const displayInfo = interruptInfo ? formatInterruptDisplay() : null;

  return (
    <div className="message-input-container" ref={containerRef}>
      
      {/* 工具调用请求区域 */}
      {interruptInfo && (
        <div className="tool-request-card">
          {/* 只有非简化中断信息才显示工具描述 */}
          {!interruptInfo.isSimpleInterrupt && (
            <div className="tool-call-info">
              <span className="tool-description">{displayInfo.displayText}</span>
              {autoApproveSettings.enabled && (
                <div className="auto-approve-notice">
                  <span className="notice-text">
                    ⚡ 自动批准已启用 (1秒延迟)
                  </span>
                </div>
              )}
            </div>
          )}
          
          <div className="tool-action-buttons">
            <button
              className="approve-button"
              onClick={handleApprove}
            >
              批准
            </button>
            <button
              className="reject-button"
              onClick={handleReject}
            >
              拒绝
            </button>
          </div>
        </div>
      )}
      
      <form onSubmit={handleSubmit} className="message-form">
        <textarea
          ref={textareaRef}
          className="message-textarea"
          value={message}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={interruptInfo ? "请输入额外信息（可选）..." : "输入@+空格可选择文件，同时按下shift+回车可换行"}
          rows={interruptInfo ? 2 : 3}
          disabled={disabled}
        />
        {showFileList && (
          <FileListPopup
            onSelectFile={handleFileSelect}
            onClose={handleCloseFileList}
            searchQuery={searchQuery}
          />
        )}
        <button
          type="submit"
          className="send-button"
          disabled={!message.trim() || disabled}
        >
          <FontAwesomeIcon icon={faPaperPlane} />
        </button>
      </form>
    </div>
  );
};

export default MessageInput;