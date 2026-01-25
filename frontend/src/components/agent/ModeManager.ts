import { useState, useEffect } from 'react';
import httpClient from '../../utils/httpClient.ts';

/**
 * 模式接口定义
 */
export interface Mode {
  id: string;
  name: string;
  type: 'builtin' | 'custom';
  description: string;
}

/**
 * 内置模式配置
 */
export const BUILTIN_MODES: Record<string, Mode> = {
  outline: {
    id: 'outline',
    name: '细纲',
    type: 'builtin',
    description: '小说创作顾问，负责与用户深度沟通本章核心需求'
  },
  writing: {
    id: 'writing',
    name: '写作',
    type: 'builtin',
    description: '专业小说代笔，基于最终版细纲进行创作'
  },
  adjustment: {
    id: 'adjustment',
    name: '调整',
    type: 'builtin',
    description: '资深编辑和小说精修师'
  }
};

/**
 * 模式管理模块 - 作为单一数据源管理所有模式状态
 * 职责：管理所有模式（内置 + 自定义）的状态和操作
 */
export const useModeManager = () => {
  // 模式状态管理 - 单一数据源
  const [customModes, setCustomModes] = useState<Mode[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  /**
   * 初始化模式管理器
   */
  const initialize = async () => {
    setIsLoading(true);
    try {
      const response = await httpClient.get(`/api/config/store?key=${encodeURIComponent('customModes')}`);
      const storedCustomModes = response || [];
      setCustomModes(storedCustomModes);
      console.log('[ModeManager] 初始化完成，自定义模式:', storedCustomModes);
    } catch (error) {
      console.error('[ModeManager] 初始化失败:', error);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * 获取所有模式（内置 + 自定义）
   */
  const getAllModes = (): Mode[] => {
    const builtInModes = Object.values(BUILTIN_MODES);
    const customModeList: Mode[] = customModes.map(mode => ({
      id: mode.id,
      name: mode.name,
      type: 'custom' as const,
      description: '自定义模式'
    }));
    
    return [...builtInModes, ...customModeList];
  };

  /**
   * 添加自定义模式
   */
  const addCustomMode = async (newMode: Mode) => {
    try {
      const updatedCustomModes = [...customModes, newMode];
      await httpClient.post('/api/config/store', {
        key: 'customModes',
        value: updatedCustomModes
      });
      setCustomModes(updatedCustomModes);
      console.log('[ModeManager] 添加自定义模式:', newMode);
      return updatedCustomModes;
    } catch (error) {
      console.error('[ModeManager] 添加自定义模式失败:', error);
      throw error;
    }
  };

  /**
   * 编辑自定义模式
   */
  const editCustomMode = async (modeId: string, updatedMode: Mode) => {
    try {
      const updatedCustomModes = customModes.map(mode =>
        mode.id === modeId ? updatedMode : mode
      );
      await httpClient.post('/api/config/store', {
        key: 'customModes',
        value: updatedCustomModes
      });
      setCustomModes(updatedCustomModes);
      console.log('[ModeManager] 编辑自定义模式:', updatedMode);
      return updatedCustomModes;
    } catch (error) {
      console.error('[ModeManager] 编辑自定义模式失败:', error);
      throw error;
    }
  };

  /**
   * 删除自定义模式
   */
  const deleteCustomMode = async (modeId: string) => {
    try {
      const updatedCustomModes = customModes.filter(mode => mode.id !== modeId);
      await httpClient.post('/api/config/store', {
        key: 'customModes',
        value: updatedCustomModes
      });
      setCustomModes(updatedCustomModes);
      console.log('[ModeManager] 删除自定义模式:', modeId);
      return updatedCustomModes;
    } catch (error) {
      console.error('[ModeManager] 删除自定义模式失败:', error);
      throw error;
    }
  };

  /**
   * 清理与自定义模式相关的设置数据
   */
  const cleanupModeSettings = async (modeId: string) => {
    try {
      // 获取当前设置
      const [customPrompts, additionalInfo, aiParameters] = await Promise.all([
        httpClient.get(`/api/config/store?key=${encodeURIComponent('customPrompts')}`).then(r => r.data || {}),
        httpClient.get(`/api/config/store?key=${encodeURIComponent('additionalInfo')}`).then(r => r.data || {}),
        httpClient.get(`/api/config/store?key=${encodeURIComponent('aiParameters')}`).then(r => r.data || {})
      ]);
      
      // 删除相关的设置数据
      const updatedPrompts = { ...customPrompts };
      delete updatedPrompts[modeId];
      
      const updatedAdditionalInfo = { ...additionalInfo };
      delete updatedAdditionalInfo[modeId];
      
      const updatedAiParameters = { ...aiParameters };
      delete updatedAiParameters[modeId];
      
      // 保存清理后的设置
      await Promise.all([
        httpClient.post('/api/config/store', { key: 'customPrompts', value: updatedPrompts }),
        httpClient.post('/api/config/store', { key: 'additionalInfo', value: updatedAdditionalInfo }),
        httpClient.post('/api/config/store', { key: 'aiParameters', value: updatedAiParameters })
      ]);
      
      console.log('[ModeManager] 清理模式设置完成:', modeId);
      
      return {
        customPrompts: updatedPrompts,
        additionalInfo: updatedAdditionalInfo,
        aiParameters: updatedAiParameters
      };
    } catch (error) {
      console.error('[ModeManager] 清理模式设置失败:', error);
      throw error;
    }
  };

  /**
   * 生成新的自定义模式ID
   */
  const generateCustomModeId = () => {
    return `custom_${Date.now()}`;
  };

  /**
   * 验证模式名称
   */
  const validateModeName = (name: string) => {
    if (!name || !name.trim()) {
      return '模式名称不能为空';
    }
    if (name.trim().length > 50) {
      return '模式名称不能超过50个字符';
    }
    
    // 检查名称是否已存在
    const allModes = getAllModes();
    const existingMode = allModes.find(mode => 
      mode.name.toLowerCase() === name.trim().toLowerCase()
    );
    if (existingMode) {
      return '模式名称已存在';
    }
    
    return null;
  };

  /**
   * 获取模式显示名称
   */
  const getModeDisplayName = (modeId: string) => {
    // 如果是内置模式
    if (isBuiltinMode(modeId)) {
      return BUILTIN_MODES[modeId as keyof typeof BUILTIN_MODES]?.name || modeId;
    }
    
    // 如果是自定义模式
    if (isCustomMode(modeId)) {
      const customMode = customModes.find(m => m.id === modeId);
      return customMode ? customMode.name : modeId;
    }
    
    return modeId;
  };

  /**
   * 获取模式描述
   */
  const getModeDescription = (modeId: string) => {
    // 如果是内置模式
    if (isBuiltinMode(modeId)) {
      return BUILTIN_MODES[modeId as keyof typeof BUILTIN_MODES]?.description || '';
    }
    
    // 如果是自定义模式
    if (isCustomMode(modeId)) {
      const customMode = customModes.find(m => m.id === modeId);
      return customMode ? '自定义模式' : '';
    }
    
    return '';
  };

  /**
   * 根据搜索文本过滤模式
   */
  const filterModes = (searchText = '') => {
    const allModes = getAllModes();
    if (!searchText.trim()) {
      return allModes;
    }
    
    const searchLower = searchText.toLowerCase();
    return allModes.filter(mode => 
      mode.name.toLowerCase().includes(searchLower) ||
      mode.description.toLowerCase().includes(searchLower)
    );
  };

  /**
   * 检查是否为内置模式
   */
  const isBuiltinMode = (modeId: string) => {
    return Object.keys(BUILTIN_MODES).includes(modeId);
  };

  /**
   * 检查是否为自定义模式
   */
  const isCustomMode = (modeId: string) => {
    return modeId.startsWith('custom_');
  };

  /**
   * 获取内置模式配置
   */
  const getBuiltinMode = (modeId: string) => {
    return BUILTIN_MODES[modeId as keyof typeof BUILTIN_MODES];
  };

  /**
   * 获取所有内置模式
   */
  const getBuiltinModes = () => {
    return Object.values(BUILTIN_MODES);
  };

  // 组件挂载时初始化
  useEffect(() => {
    initialize();
  }, []);

  return {
    // 状态
    customModes,
    isLoading,
    
    // 核心操作
    initialize,
    getAllModes,
    addCustomMode,
    editCustomMode,
    deleteCustomMode,
    cleanupModeSettings,
    filterModes,
    
    // 工具方法
    generateCustomModeId,
    validateModeName,
    getModeDisplayName,
    getModeDescription,
    isBuiltinMode,
    isCustomMode,
    
    // 内置模式相关
    BUILTIN_MODES,
    getBuiltinMode,
    getBuiltinModes
  };
};

export default useModeManager;
