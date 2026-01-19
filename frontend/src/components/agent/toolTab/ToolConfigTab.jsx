import { useState, useEffect } from 'react';
import httpClient from '../../../utils/httpClient.js';

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
      setToolConfig(response);
      setOriginalConfig(response);
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
      <div className="p-5 max-h-[600px] overflow-y-auto">
        <div className="flex justify-center items-center h-[200px]">
          <p className="text-theme-white text-base">正在加载工具配置...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-5 max-h-[600px] overflow-y-auto">
      <div className="mb-5 pb-4 border-b border-theme-gray1">
        <h4 className="m-0 text-theme-white text-lg font-semibold">工具配置</h4>
      </div>

      <div className="mb-6 p-4 bg-theme-gray1 rounded-medium border-l-4 border-theme-green">
        <p className="m-0 text-theme-white text-sm leading-relaxed">
          在此配置模式下AI可以使用的工具。启用工具后，AI将能够调用这些工具来完成相关任务。
        </p>
      </div>

      {/* 工具分类列表 */}
      <div className="flex flex-col gap-5">
        {Object.entries(toolConfig.tool_categories).map(([categoryName, tools]) => (
          <div key={categoryName} className="bg-theme-black border border-theme-gray1 rounded-medium p-5 shadow-light">
            <div className="flex justify-between items-center mb-4">
              <h5 className="m-0 text-theme-white text-base font-semibold">{getCategoryDisplayName(categoryName)}</h5>
              <button
                className="px-3 py-1.5 bg-theme-gray1 text-theme-white border border-theme-gray1 rounded-small text-xs cursor-pointer transition-all hover:bg-theme-gray1"
                onClick={() => toggleToolCategory(categoryName)}
                title={isCategoryAllEnabled(categoryName) ? '禁用所有' : '启用所有'}
              >
                {isCategoryAllEnabled(categoryName) ? '全部禁用' : '全部启用'}
              </button>
            </div>

            <div className="mb-2.5">
              {isCategoryPartialEnabled(categoryName) && (
                <span className="inline-block px-2 py-0.5 bg-theme-green text-theme-black rounded-full text-xs font-medium">部分启用</span>
              )}
            </div>

            <div className="flex flex-col gap-3">
              {tools.map(toolName => (
                <div key={toolName} className="flex flex-col gap-1.5 p-3 bg-theme-gray1 rounded-small border border-theme-gray1 transition-all hover:bg-theme-gray1 hover:border-theme-green">
                  <label className="flex items-center gap-2.5 cursor-pointer m-0 font-medium text-theme-white">
                    <input
                      type="checkbox"
                      checked={toolConfig.enabled_tools.includes(toolName)}
                      onChange={() => toggleTool(toolName)}
                      className="hidden"
                    />
                    <span className={`w-4.5 h-4.5 border-2 border-theme-gray1 rounded-small relative transition-all ${toolConfig.enabled_tools.includes(toolName) ? 'bg-theme-green border-theme-green' : ''}`}>
                      {toolConfig.enabled_tools.includes(toolName) && (
                        <span className="absolute left-1.25 top-0.5 w-1 h-2.5 border-solid border-white border-r-0 border-t-0 transform rotate-45"></span>
                      )}
                    </span>
                    <span className="text-sm font-medium">{getToolDisplayName(toolName)}</span>
                  </label>
                  <div className="text-xs text-theme-white ml-7 leading-relaxed">
                    {getToolDescription(toolName)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* 已启用的工具统计 */}
      <div className="mt-6 p-5 bg-theme-gray1 rounded-medium border border-theme-gray1">
        <h5 className="m-0 mb-3 text-theme-white text-base font-semibold">已启用工具统计</h5>
        <div className="flex flex-col gap-2">
          <p className="m-0 text-theme-white text-sm">总共启用: <strong className="text-theme-white">{toolConfig.enabled_tools.length}</strong> 个工具</p>
          <p className="m-0 text-theme-white text-sm">可用工具总数: <strong className="text-theme-white">{toolConfig.all_available_tools.length}</strong> 个</p>
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
