import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faUndo } from '@fortawesome/free-solid-svg-icons';
import httpClient from '../../../utils/httpClient.js';
import './ToolConfigTab.css';

/**
 * 工具配置标签页组件
 * 负责管理每个模式的工具启用状态
 */
const ToolConfigTab = ({ mode, modeType, onToolConfigChange }) => {
  // 状态管理
  const [toolConfig, setToolConfig] = useState({
    enabled_tools: [],
    tool_categories: {},
    all_available_tools: []
  });
  const [isLoading, setIsLoading] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [originalConfig, setOriginalConfig] = useState(null);

  // 加载工具配置
  const loadToolConfig = async () => {
    setIsLoading(true);
    try {
      const response = await httpClient.get(`/api/tool-config/modes/${mode}`);
      setToolConfig(response.data);
      setOriginalConfig(response.data);
      setHasChanges(false);
    } catch (error) {
      console.error('调用工具配置API失败:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // 通知父组件配置变更
  const notifyConfigChange = (newConfig) => {
    if (onToolConfigChange) {
      onToolConfigChange(mode, newConfig);
    }
  };

  // 重置工具配置
  const resetToolConfig = async () => {
    try {
      const response = await httpClient.post(`/api/tool-config/modes/${mode}/reset`);
      setToolConfig(response.data);
      setOriginalConfig(response.data);
      setHasChanges(false);
      console.log('工具配置重置成功');
    } catch (error) {
      console.error('调用重置工具配置API失败:', error);
    }
  };

  // 切换工具启用状态
  const toggleTool = (toolName) => {
    const newEnabledTools = [...toolConfig.enabled_tools];
    const toolIndex = newEnabledTools.indexOf(toolName);
    
    if (toolIndex > -1) {
      // 如果工具已启用，则禁用
      newEnabledTools.splice(toolIndex, 1);
    } else {
      // 如果工具未启用，则启用
      newEnabledTools.push(toolName);
    }
    
    const newConfig = {
      ...toolConfig,
      enabled_tools: newEnabledTools
    };
    
    setToolConfig(newConfig);
    setHasChanges(true);
    notifyConfigChange(newConfig);
  };

  // 切换整个工具分类
  const toggleToolCategory = (categoryName) => {
    const categoryTools = toolConfig.tool_categories[categoryName] || [];
    const allEnabled = categoryTools.every(tool =>
      toolConfig.enabled_tools.includes(tool)
    );
    
    const newEnabledTools = [...toolConfig.enabled_tools];
    
    if (allEnabled) {
      // 如果分类中所有工具都已启用，则禁用所有
      categoryTools.forEach(tool => {
        const index = newEnabledTools.indexOf(tool);
        if (index > -1) {
          newEnabledTools.splice(index, 1);
        }
      });
    } else {
      // 如果分类中有工具未启用，则启用所有
      categoryTools.forEach(tool => {
        if (!newEnabledTools.includes(tool)) {
          newEnabledTools.push(tool);
        }
      });
    }
    
    const newConfig = {
      ...toolConfig,
      enabled_tools: newEnabledTools
    };
    
    setToolConfig(newConfig);
    setHasChanges(true);
    notifyConfigChange(newConfig);
  };

  // 检查分类是否全部启用
  const isCategoryAllEnabled = (categoryName) => {
    const categoryTools = toolConfig.tool_categories[categoryName] || [];
    return categoryTools.length > 0 && 
           categoryTools.every(tool => toolConfig.enabled_tools.includes(tool));
  };

  // 检查分类是否部分启用
  const isCategoryPartialEnabled = (categoryName) => {
    const categoryTools = toolConfig.tool_categories[categoryName] || [];
    const enabledCount = categoryTools.filter(tool => 
      toolConfig.enabled_tools.includes(tool)
    ).length;
    return enabledCount > 0 && enabledCount < categoryTools.length;
  };

  // 组件挂载时加载配置
  useEffect(() => {
    loadToolConfig();
  }, [mode]);

  if (isLoading) {
    return (
      <div className="tool-config-tab">
        <div className="loading-tools">
          <p>正在加载工具配置...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="tool-config-tab">
      <div className="tool-config-header">
        <h4>工具配置</h4>
        <div className="tool-config-actions">
          <button
            className="reset-tools-btn"
            onClick={resetToolConfig}
            disabled={!hasChanges && originalConfig}
          >
            <FontAwesomeIcon icon={faUndo} /> 重置
          </button>
        </div>
      </div>

      <div className="tool-config-description">
        <p>
          在此配置模式下AI可以使用的工具。启用工具后，AI将能够调用这些工具来完成相关任务。
        </p>
      </div>

      {/* 工具分类列表 */}
      <div className="tool-categories">
        {Object.entries(toolConfig.tool_categories).map(([categoryName, tools]) => (
          <div key={categoryName} className="tool-category">
            <div className="category-header">
              <h5>{getCategoryDisplayName(categoryName)}</h5>
              <button
                className="category-toggle-btn"
                onClick={() => toggleToolCategory(categoryName)}
                title={isCategoryAllEnabled(categoryName) ? '禁用所有' : '启用所有'}
              >
                {isCategoryAllEnabled(categoryName) ? '全部禁用' : '全部启用'}
              </button>
            </div>
            
            <div className="category-status">
              {isCategoryPartialEnabled(categoryName) && (
                <span className="partial-status">部分启用</span>
              )}
            </div>
            
            <div className="tool-list">
              {tools.map(toolName => (
                <div key={toolName} className="tool-item">
                  <label className="tool-checkbox">
                    <input
                      type="checkbox"
                      checked={toolConfig.enabled_tools.includes(toolName)}
                      onChange={() => toggleTool(toolName)}
                    />
                    <span className="checkmark"></span>
                    <span className="tool-name">{getToolDisplayName(toolName)}</span>
                  </label>
                  <div className="tool-description">
                    {getToolDescription(toolName)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* 已启用的工具统计 */}
      <div className="enabled-tools-summary">
        <h5>已启用工具统计</h5>
        <div className="summary-content">
          <p>总共启用: <strong>{toolConfig.enabled_tools.length}</strong> 个工具</p>
          <p>可用工具总数: <strong>{toolConfig.all_available_tools.length}</strong> 个</p>
        </div>
      </div>
    </div>
  );
};

// 工具名称显示映射
const getToolDisplayName = (toolName) => {
  const displayNames = {
    'read_file': '读取文件',
    'write_file': '写入文件',
    'apply_diff': '应用差异',
    'insert_content': '插入内容',
    'search_file': '搜索文件',
    'search_and_replace': '搜索替换',
    'ask_user_question': '询问用户',
    'search_embedding': '搜索嵌入',
    'list_knowledge_base': '列出知识库'
  };
  return displayNames[toolName] || toolName;
};

// 工具描述映射
const getToolDescription = (toolName) => {
  const descriptions = {
    'read_file': '读取指定文件的内容，支持段落范围选择',
    'write_file': '创建或覆盖文件内容',
    'apply_diff': '应用差异修改到文件',
    'insert_content': '在文件中插入内容',
    'search_file': '搜索文件中的内容',
    'search_and_replace': '搜索并替换文件内容',
    'ask_user_question': '向用户提问获取信息',
    'search_embedding': '在知识库中搜索相关内容',
    'list_knowledge_base': '列出知识库中的文件'
  };
  return descriptions[toolName] || '工具功能描述';
};

// 分类名称显示映射
const getCategoryDisplayName = (categoryName) => {
  const displayNames = {
    'file_operations': '文件操作',
    'user_interaction': '用户交互',
    'knowledge_base': '知识库操作'
  };
  return displayNames[categoryName] || categoryName;
};

export default ToolConfigTab;