import { useRef, useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faAngleRight, faAngleUp } from '@fortawesome/free-solid-svg-icons';
import type { RootState } from '../../store/store';
import type { Message, AIMessage } from '../../types/langchain';
import { setAvailableTools } from '../../store/mode';
import { selectMessages } from '../../store/chat';
import { addTempFile } from '../../store/file';
import { createTempDiffTab, updateDiffTabContent } from '../../store/editor';
import httpClient from '../../utils/httpClient';

// 支持的文件工具列表
const FILE_TOOLS = ['write_file', 'insert_content', 'apply_diff', 'search_and_replace'];

const MessageDisplayPanel = () => {
  const dispatch = useDispatch();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [expandedTools, setExpandedTools] = useState<Set<string>>(new Set());
  const [expandedToolResults, setExpandedToolResults] = useState<Set<string>>(new Set());
  
  // 从Redux获取可用工具信息
  const availableTools = useSelector((state: RootState) => state.modeSlice.availableTools);
  
  // 从Redux获取消息列表
  const messages = useSelector((state: RootState) => selectMessages(state));

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
  }, []);

  // 验证文件名是否以.md结尾。"测试文件.md"√，"侧"×，"测试"×，"测试文"×，"测试文件.m"×
  const isValidMdFile = (path: string): boolean => {
    return path.endsWith('.md');
  };

  // 解析diff内容，计算修改后的内容
  const applyDiff = (originalContent: string, diff: string): string => {
    const lines = originalContent.split('\n');
    const result = [...lines];
    const blocks = diff.split('<<<<<<< SEARCH');
    
    for (const block of blocks) {
      if (!block.trim()) continue;
      
      const parts = block.split('=======');
      if (parts.length < 2) continue;
      
      const searchPart = parts[0];
      const replacePart = parts[1]?.split('>>>>>>> REPLACE')[0];
      
      if (!searchPart || !replacePart) continue;
      
      // 提取起始行号
      const lineMatch = searchPart.match(/:start_line:(\d+)/);
      if (!lineMatch || !lineMatch[1]) continue;
      
      const startLine = parseInt(lineMatch[1], 10) - 1; // 转换为0-based
      
      // 提取要搜索的内容
      const searchStart = searchPart.indexOf('-------') + 7;
      const searchText = searchPart.substring(searchStart).trim();
      
      // 查找匹配的行
      let matchIndex = -1;
      const searchLines = searchText.split('\n');
      
      for (let i = startLine; i <= result.length - searchLines.length; i++) {
        let match = true;
        for (let j = 0; j < searchLines.length; j++) {
          if (result[i + j] !== searchLines[j]) {
            match = false;
            break;
          }
        }
        if (match) {
          matchIndex = i;
          break;
        }
      }
      
      if (matchIndex !== -1) {
        // 替换内容
        const replaceLines = replacePart.trim().split('\n');
        result.splice(matchIndex, searchLines.length, ...replaceLines);
      }
    }
    
    return result.join('\n');
  };

  // 搜索并替换文本
  const searchAndReplace = (content: string, search: string, replace: string, useRegex: boolean = false, ignoreCase: boolean = false): string => {
    if (useRegex) {
      const flags = ignoreCase ? 'gi' : 'g';
      const regex = new RegExp(search, flags);
      return content.replace(regex, replace);
    } else {
      if (ignoreCase) {
        const regex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
        return content.replace(regex, replace);
      } else {
        return content.split(search).join(replace);
      }
    }
  };

  // 在指定位置插入内容
  const insertContent = (content: string, paragraph: number, newContent: string): string => {
    const lines = content.split('\n');
    
    if (paragraph === 0) {
      // 在文件末尾追加
      lines.push(newContent);
    } else {
      // 在指定段落插入
      const insertIndex = Math.min(paragraph - 1, lines.length);
      lines.splice(insertIndex, 0, newContent);
    }
    
    return lines.join('\n');
  };

  // 获取文件内容
  const fetchFileContent = async (path: string): Promise<string> => {
    try {
      const result = await httpClient.get(`/api/file/read/${encodeURIComponent(path)}`);
      return result?.content || '';
    } catch (error) {
      console.error(`读取文件 ${path} 失败:`, error);
      return '';
    }
  };

  // 处理文件工具调用
  const handleFileToolCall = async (toolName: string, args: any) => {
    const parsedArgs = typeof args === 'string' ? JSON.parse(args) : args;
    const path = parsedArgs.path;
    
    if (!path || !isValidMdFile(path)) {
      return;
    }

    // 添加临时文件到文件树
    dispatch(addTempFile({ path }));

    // 获取原文件内容（所有工具都需要获取原内容）
    const originalContent = await fetchFileContent(path);
    let modifiedContent = originalContent;

    // 根据工具类型计算修改后的内容
    switch (toolName) {
      case 'write_file': {
        const content = parsedArgs.content;
        if (content !== undefined) {
          modifiedContent = content;
        }
        break;
      }
      
      case 'insert_content': {
        const paragraph = parsedArgs.paragraph;
        const content = parsedArgs.content;
        
        if (paragraph !== undefined && content !== undefined) {
          modifiedContent = insertContent(originalContent, paragraph, content);
        }
        break;
      }
      
      case 'apply_diff': {
        const diff = parsedArgs.diff;
        
        if (diff) {
          modifiedContent = applyDiff(originalContent, diff);
        }
        break;
      }
      
      case 'search_and_replace': {
        const search = parsedArgs.search;
        const replace = parsedArgs.replace;
        const useRegex = parsedArgs.use_regex || false;
        const ignoreCase = parsedArgs.ignore_case || false;
        
        if (search !== undefined && replace !== undefined) {
          modifiedContent = searchAndReplace(originalContent, search, replace, useRegex, ignoreCase);
        }
        break;
      }
    }

    // 创建差异对比标签页（backUp为原内容，currentData为修改后的内容）
    dispatch(createTempDiffTab({ id: path, originalContent, modifiedContent }));
  };

  // 实时监测文件工具调用（只检查最后一条消息）
  useEffect(() => {
    if (messages.length === 0) return;
    const lastMessage = messages[messages.length - 1];
    
    // 只有当最后一条消息是AI消息且有工具调用时才处理
    if (lastMessage!.type === 'ai' && (lastMessage as AIMessage).tool_calls) {
      (lastMessage as AIMessage).tool_calls.forEach(toolCall => {
        const toolName = toolCall.name;
        
        // 只处理支持的文件工具
        if (FILE_TOOLS.includes(toolName || '')) {
          const args = toolCall.args;
          
          if ((args as any)._loading && (args as any)._partial_args) {
            // 处理加载中的_partial_args
            try {
              const partialArgs = JSON.parse((args as any)._partial_args);
              handleFileToolCall(toolName || '', partialArgs);
            } catch (e) {
              console.error("解析_partial_args失败:", e);
            }
          } else {
            // 处理完整的args
            handleFileToolCall(toolName || '', args);
          }
        }
      });
    }
  }, [messages, dispatch]);

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

  // 获取预览内容（第一行或前几个字）
  const getPreviewContent = (content: string): string => {
    const lines = content.split('\n');
    const firstLine = lines[0]?.trim() || '';
    if (firstLine.length > 50) {
      return firstLine.substring(0, 50) + '...';
    }
    return firstLine || '...';
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
    
    // 工具结果消息独立渲染
    if (isToolResult) {
      const isExpanded = expandedToolResults.has(msg.id);
      const previewContent = getPreviewContent(msg.content || '');
      
      return (
        <div
          key={msg.id}
          className="flex flex-col max-w-[80%] self-start bg-theme-gray1 border border-theme-green p-2.5 rounded-medium break-words overflow-wrap break-word"
        >
          <div className="flex items-center justify-between cursor-pointer" onClick={() => toggleToolResultExpand(msg.id)}>
            <div className="flex items-center">
              <FontAwesomeIcon icon={isExpanded ? faAngleUp : faAngleRight} className="text-theme-green hover:text-theme-white text-xs mr-2" />
              <span className="font-bold text-[0.9em] text-theme-white">工具</span>
            </div>
          </div>
          <div className="leading-[1.4] overflow-wrap break-word break-words text-theme-white mt-1">
            {isExpanded ? (
              <div className="whitespace-pre-wrap">{msg.content}</div>
            ) : (
              <div className="text-theme-gray3 text-sm">{previewContent}</div>
            )}
          </div>
        </div>
      );
    }
    
    // 用户消息、AI消息
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
          {isUser ? '用户' : 'AI'}
        </div>
        <div className="leading-[1.4] overflow-wrap break-word break-words">
          {isUser ? (
            <div className="whitespace-pre-wrap">{msg.content}</div>
          ) : (
            <div>
              <div className="whitespace-pre-wrap">{msg.content}</div>
              {msg.type === 'ai' && (msg as AIMessage).tool_calls && (msg as AIMessage).tool_calls.length > 0 && (
                <div className="mt-2 p-2 bg-black/20 rounded-small">
                  {(msg as AIMessage).tool_calls.map((toolCall, toolIndex) => {
                    const toolKey = `${msg.id}-${toolIndex}`;
                    const isExpanded = expandedTools.has(toolKey);
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
              {msg.type === 'ai' && (msg as AIMessage).usage_metadata && (
                <div className="mt-2 text-[0.75em] text-theme-gray3">
                  输入: {(msg as AIMessage).usage_metadata?.input_tokens || 0} / 输出: {(msg as AIMessage).usage_metadata?.output_tokens || 0}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
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
  );
};

export default MessageDisplayPanel;
