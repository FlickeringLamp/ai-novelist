import React, { useState, useEffect } from 'react';
import './AutoApproveConfig.css';
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
      <div className="auto-approve-config loading">
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
    <div className="auto-approve-container">
      <div
        className="auto-approve-button"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <span className="auto-approve-status">{getDisplayStatusText()}</span>
        <span className="expand-icon">{isExpanded ? '▲' : '▶'}</span>
      </div>

      {isExpanded && (
        <div className="auto-approve-panel">
          <div className="auto-approve-content">
            <div className="setting-group">
              <label className="setting-label">
                <input
                  type="checkbox"
                  checked={autoApproveSettings.enabled}
                  onChange={(e) => handleEnabledChange(e.target.checked)}
                />
                <span className="checkmark"></span>
                启用自动批准
              </label>
              <div className="setting-description">
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