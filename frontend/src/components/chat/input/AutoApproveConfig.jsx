import { useState, useEffect } from 'react';
import httpClient from '../../../utils/httpClient.js';

/**
 * 自动批准配置组件
 * 负责管理工具调用的自动批准设置，使用本地状态而不依赖Redux
 */
const AutoApproveConfig = ({ onSettingsChange }) => {
  // 本地状态管理
  const [autoApproveSettings, setAutoApproveSettings] = useState({
    enabled: false,
    delay: 1000
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  // 加载自动批准设置
  useEffect(() => {
    const loadSettings = async () => {
      setIsLoading(true);
      try {
        const response = await httpClient.get(`/api/config/store?key=${encodeURIComponent('autoApproveSettings')}`);
        if (response) {
          setAutoApproveSettings({
            ...response,
            delay: 1000
          });
        }
      } catch (error) {
        console.error('加载自动批准设置失败:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    loadSettings();
  }, []);

  // 点击外部关闭下拉菜单
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (isExpanded && !e.target.closest('.auto-approve-container')) {
        setIsExpanded(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isExpanded]);

  // 保存自动批准设置
  const saveSettings = async (newSettings) => {
    try {
      await httpClient.post('/api/config/store', {
        key: 'autoApproveSettings',
        value: newSettings
      });
      setAutoApproveSettings(newSettings);
      
      // 通知父组件设置已更改
      if (onSettingsChange) {
        onSettingsChange(newSettings);
      }
    } catch (error) {
      console.error('保存自动批准设置失败:', error);
    }
  };

  // 处理启用状态切换
  const handleEnabledChange = (enabled) => {
    const newSettings = { ...autoApproveSettings, enabled, delay: 1000 };
    saveSettings(newSettings);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-4 text-theme-white text-[14px]">
        <p>正在加载自动批准配置...</p>
      </div>
    );
  }

  // 获取当前状态的显示文本
  const getDisplayStatusText = () => {
    if (isLoading) return '正在加载...';
    return autoApproveSettings.enabled ? '自动批准已开启 (1秒)' : '自动批准已关闭';
  };

  return (
    <div className="relative flex w-full z-[100] box-border">
      <div
        className="flex items-center justify-center w-full p-2 p-2.5-[12px] bg-theme-black border border-theme-gray1 rounded-small cursor-pointer transition-all min-h-[36px] box-border hover:border-theme-green hover:bg-theme-gray1"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <span className="text-theme-white text-[14px] font-medium whitespace-nowrap overflow-hidden text-ellipsis w-full text-center">{getDisplayStatusText()}</span>
        <span className="text-theme-white text-[12px] ml-2 transition-transform">{isExpanded ? '▲' : '▶'}</span>
      </div>

      {isExpanded && (
        <div className="absolute bottom-full left-[-10px] right-[-150px] bg-theme-black border border-theme-gray1 rounded-small shadow-deep z-[1000] mb-1 overflow-hidden">
          <div className="p-3">
            <div className="mb-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoApproveSettings.enabled}
                  onChange={(e) => handleEnabledChange(e.target.checked)}
                  className="w-4 h-4 accent-theme-green cursor-pointer"
                />
                <span className="text-theme-white text-[14px]">启用自动批准</span>
              </label>
              <div className="text-theme-white text-[12px] mt-2">
                启用后，工具调用将在1秒后自动批准，无需手动确认
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AutoApproveConfig;
