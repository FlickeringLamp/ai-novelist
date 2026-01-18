import { useState, useEffect } from 'react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSave, faTimes, faPlus, faEdit, faTrash } from '@fortawesome/free-solid-svg-icons';
import httpClient from '../../utils/httpClient.js';
import useModeManager from './ModeManager';
import UnifiedModal from '../others/UnifiedModal.jsx';
import ChatParameters from '././parameterTab/ChatParameters';
import FileSelector from './FileSelector';
import ToolConfigTab from './toolTab/ToolConfigTab';
import './AgentPanel.css';

/**
 * 统一的Agent面板组件 - 整合了原来的三个GeneralSettings文件的功能
 */
const AgentPanel = ({ isOpen = true, onClose }) => {
  // UI状态 - 专注于展示和交互
  const [selectedMode, setSelectedMode] = useState('outline');
  const [searchText, setSearchText] = useState('');
  const [showCustomModeForm, setShowCustomModeForm] = useState(false);
  const [editingMode, setEditingMode] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [newModeName, setNewModeName] = useState('');
  const [activeTab, setActiveTab] = useState('prompt');
  const [notification, setNotification] = useState({
    isOpen: false,
    message: '',
    success: false
  });

  // 模式配置状态
  const [customPrompts, setCustomPrompts] = useState({});
  const [additionalInfo, setAdditionalInfo] = useState({});
  const [aiParameters, setAiParameters] = useState({});
  const [toolConfigs, setToolConfigs] = useState({});
  const [allModesList, setAllModesList] = useState([]);

  // 使用模式管理模块 - 单一数据源
  const modeManager = useModeManager();

  // 加载模式配置
  const loadModeConfig = async () => {
    try {
      const [customPromptsData, additionalInfoData, aiParametersData] = await Promise.all([
        httpClient.get(`/api/config/store?key=${encodeURIComponent('customPrompts')}`).then(r => r.data),
        httpClient.get(`/api/config/store?key=${encodeURIComponent('additionalInfo')}`).then(r => r.data),
        httpClient.get(`/api/config/store?key=${encodeURIComponent('aiParameters')}`).then(r => r.data)
      ]);
      
      setCustomPrompts(customPromptsData || {});
      setAdditionalInfo(additionalInfoData || {});
      setAiParameters(aiParametersData || {});
    } catch (error) {
      console.error('加载模式配置失败:', error);
    }
  };
  // 加载所有模式列表
  const loadAllModes = () => {
    const modes = modeManager.getAllModes();
    setAllModesList(modes);
  };

  // 统一数据初始化
  const initializeData = async () => {
    try {
      // 加载模式配置
      await loadModeConfig();
      
      // 加载所有模式列表
      loadAllModes();
      
    } catch (error) {
      console.error('[AgentPanel] 数据初始化失败:', error);
    }
  };

  useEffect(() => {
    initializeData();
  }, []);

  // 统一设置变更处理 - 直接更新本地状态
  const handlePromptChange = async (mode, value) => {
    const updatedPrompts = {
      ...customPrompts,
      [mode]: value
    };
    setCustomPrompts(updatedPrompts);
    
    // 保存到后端
    try {
      await httpClient.post('/api/config/store', {
        key: 'customPrompts',
        value: updatedPrompts
      });
    } catch (error) {
      console.error('保存自定义提示词失败:', error);
    }
  };


  const handleAdditionalInfoChange = async (mode, value) => {
    const updatedAdditionalInfo = {
      ...additionalInfo,
      [mode]: value
    };
    console.log("配置了什么玩意",updatedAdditionalInfo)
    setAdditionalInfo(updatedAdditionalInfo);
    
    // 保存到后端
    try {
      await httpClient.post('/api/config/store', {
        key: 'additionalInfo',
        value: updatedAdditionalInfo
      });
    } catch (error) {
      console.error('保存附加信息失败:', error);
    }
  };

  const handleAiParametersChange = async (mode, newParameters) => {
    const updatedAiParameters = {
      ...aiParameters,
      [mode]: newParameters
    };
    setAiParameters(updatedAiParameters);
    
    // 保存到后端
    try {
      await httpClient.post('/api/config/store', {
        key: 'aiParameters',
        value: updatedAiParameters
      });
    } catch (error) {
      console.error('保存AI参数失败:', error);
    }
  };

  // 处理工具配置变更
  const handleToolConfigChange = async (mode, newConfig) => {
    const updatedToolConfigs = {
      ...toolConfigs,
      [mode]: newConfig
    };
    setToolConfigs(updatedToolConfigs);
    
    // 保存到后端
    try {
      await httpClient.put(`/api/tool-config/modes/${mode}`, {
        enabled_tools: newConfig.enabled_tools
      });
    } catch (error) {
      console.error('保存工具配置失败:', error);
    }
  };

  // 保存设置 - 直接使用本地状态和工具配置
  const handleSave = async () => {
    try {
      console.log('[AgentPanel] 开始保存通用设置和工具配置');
      
      // 保存到后端 - 直接使用本地状态
      await Promise.all([
        httpClient.post('/api/config/store', { key: 'customPrompts', value: customPrompts }),
        httpClient.post('/api/config/store', { key: 'additionalInfo', value: additionalInfo }),
        httpClient.post('/api/config/store', { key: 'aiParameters', value: aiParameters })
      ]);
      
      // 通知保存成功
      showNotification('通用设置保存成功！', true);
    } catch (error) {
      console.error('保存通用设置失败:', error);
      showNotification('通用设置保存失败，请重试。', false);
    }
  };

  // 通知处理
  const showNotification = (message, success = true) => {
    setNotification({
      isOpen: true,
      message,
      success
    });
  };

  const handleNotificationClose = () => {
    setNotification({ isOpen: false, message: '', success: false });
    if (notification.success && onClose) {
      onClose();
    }
  };

  // 模式管理相关函数 - 通过ModeManager获取
  const getModeDisplayName = (mode) => {
    return modeManager.getModeDisplayName(mode);
  };

  const getAllModes = () => {
    return modeManager.getAllModes();
  };

  const filteredModes = modeManager.filterModes(searchText);

  // 获取当前选中的模式详情 - 使用本地状态
  const selectedModeDetail = {
    name: getModeDisplayName(selectedMode),
    customPrompt: customPrompts[selectedMode] || '',
    additionalInfo: (additionalInfo && additionalInfo[selectedMode]) ? additionalInfo[selectedMode] : {},
    aiParameters: (aiParameters && aiParameters[selectedMode]) ? aiParameters[selectedMode] : {
      temperature: 0.7,
      top_p: 0.7,
      n: 1,
      max_tokens: 4000
    },
    type: modeManager.isCustomMode(selectedMode) ? 'custom' : 'builtin'
  };
  
  // 打印 selectedModeDetail 信息
  console.log('selectedModeDetail:', selectedModeDetail);

  // 处理添加自定义模式
  const handleAddCustomModeUI = async () => {
    if (newModeName.trim()) {
      const validationError = modeManager.validateModeName(newModeName);
      if (validationError) {
        showNotification(validationError, false);
        return;
      }
      
      try {
        const modeId = modeManager.generateCustomModeId();
        await modeManager.addCustomMode({
          id: modeId,
          name: newModeName.trim()
        });
        setNewModeName('');
        setShowCustomModeForm(false);
        setSelectedMode(modeId);
        
        // 重新加载模式列表
        loadAllModes();
        
        showNotification('自定义模式添加成功', true);
      } catch (error) {
        showNotification('添加自定义模式失败', false);
      }
    }
  };

  // 处理编辑自定义模式
  const handleEditCustomModeUI = async () => {
    if (newModeName.trim() && editingMode) {
      const validationError = modeManager.validateModeName(newModeName);
      if (validationError) {
        showNotification(validationError, false);
        return;
      }
      
      try {
        await modeManager.editCustomMode(editingMode.id, {
          ...editingMode,
          name: newModeName.trim()
        });
        setNewModeName('');
        setShowCustomModeForm(false);
        setEditingMode(null);
        
        // 重新加载模式列表
        loadAllModes();
        
        showNotification('自定义模式编辑成功', true);
      } catch (error) {
        showNotification('编辑自定义模式失败', false);
      }
    }
  };

  // 处理删除自定义模式
  const handleDeleteCustomModeUI = async () => {
    if (selectedModeDetail.type === 'custom') {
      try {
        await modeManager.deleteCustomMode(selectedMode);
        await modeManager.cleanupModeSettings(selectedMode);
        setShowDeleteConfirm(false);
        
        // 重新加载模式列表和配置
        await Promise.all([
          loadAllModes(),
          loadModeConfig()
        ]);
        
        // 删除后切换到第一个模式
        const allModes = getAllModes();
        if (allModes.length > 0) {
          setSelectedMode(allModes[0].id);
        }
        
        showNotification('自定义模式删除成功', true);
      } catch (error) {
        showNotification('删除自定义模式失败', false);
      }
    }
  };

  // 开始编辑自定义模式
  const startEditCustomMode = () => {
    const customMode = modeManager.customModes.find(m => m.id === selectedMode);
    if (customMode) {
      setEditingMode(customMode);
      setNewModeName(customMode.name);
      setShowCustomModeForm(true);
    }
  };

  // 渲染标签页内容
  const renderTabContent = () => {
    switch (activeTab) {
      case 'ai':
        return (
          <div className="tab-content">
            <ChatParameters
              aiParameters={aiParameters}
              onParametersChange={handleAiParametersChange}
              mode={selectedMode}
            />
          </div>
        );
      case 'tools':
        return (
          <div className="tab-content">
            <ToolConfigTab
              mode={selectedMode}
              modeType={selectedModeDetail.type}
              onToolConfigChange={handleToolConfigChange}
            />
          </div>
        );
      case 'prompt':
      default:
        return (
          <div className="prompt-sections">
            {/* 自定义提示词 */}
            <div className="custom-prompt">
              <h4>自定义提示词:</h4>
              <textarea
                value={selectedModeDetail.customPrompt}
                onChange={(e) => handlePromptChange(selectedMode, e.target.value)}
                placeholder={`输入${selectedModeDetail.name}模式的自定义提示词...`}
                rows={4}
              />
            </div>

            {/* 附加文件框 */}
            <div className="additional-files-section">
              <h4>附加文件:</h4>
              <div className="additional-files-container">
                <FileSelector
                  onFileContentAdd={(content) => {
                    const newFile = {
                      content: content
                    };
                    handleAdditionalInfoChange(selectedMode, newFile);
                  }}
                />
                
                {/* 显示已添加的文件 */}
                <div className="attached-files-list">
                  <h5>已添加的文件:</h5>
                  {selectedModeDetail.additionalInfo && selectedModeDetail.additionalInfo.content ? (
                    <div className="attached-file-item">
                      <span className="file-name">{selectedModeDetail.additionalInfo.content.path}</span>
                      <button
                        className="remove-file-button"
                        onClick={() => {
                          handleAdditionalInfoChange(selectedMode, {});
                        }}
                      >
                        <FontAwesomeIcon icon={faTimes} />
                      </button>
                    </div>
                  ) : (
                    <div className="no-files">暂无附加文件</div>
                  )}
                </div>
              </div>
            </div>

          </div>
        );
    }
  };

  if (!isOpen) return null;

  return (
    <div className="general-settings-panel">
      {/* 头部操作栏 */}
      <div className="agent-panel-header">
        <h2>Agent设置面板</h2>
        <div className="header-actions">
          <button className="save-button" onClick={handleSave}>
            <FontAwesomeIcon icon={faSave} /> 保存
          </button>
          {onClose && (
            <button className="close-button" onClick={onClose}>
              <FontAwesomeIcon icon={faTimes} /> 关闭
            </button>
          )}
        </div>
      </div>

      <PanelGroup direction="horizontal" className="settings-panel-group">
        {/* 左侧模式列表 */}
        <Panel defaultSize={25} minSize={0} maxSize={100} className="mode-list-panel">
          <div className="mode-list-container">
            <div className="mode-list-header">
              <h3>模式设置</h3>
              <div className="search-container">
                <input
                  type="text"
                  placeholder="搜索模式..."
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  className="mode-search"
                />
              </div>
            </div>
            
            <div className="mode-list">
              {filteredModes.map(mode => (
                <div
                  key={mode.id}
                  className={`mode-item ${selectedMode === mode.id ? 'active' : ''}`}
                  onClick={() => setSelectedMode(mode.id)}
                >
                  <div className="mode-info">
                    <div className="mode-name">{mode.name}</div>
                    <div className="mode-type">
                      {mode.type === 'custom' ? '自定义模式' : '内置模式'}
                    </div>
                  </div>
                  <div className="mode-status">
                    {customPrompts[mode.id] ? '已自定义' : '默认'}
                  </div>
                </div>
              ))}
            </div>

            <div className="mode-list-actions">
              <button
                className="add-mode-btn"
                onClick={() => {
                  setShowCustomModeForm(true);
                  setEditingMode(null);
                  setNewModeName('');
                }}
              >
                <FontAwesomeIcon icon={faPlus} /> 添加自定义模式
              </button>
            </div>
          </div>
        </Panel>

        {/* 分隔条 */}
        <PanelResizeHandle className="panel-resize-handle">
          <div className="resize-handle-inner" />
        </PanelResizeHandle>

        {/* 右侧设置面板 */}
        <Panel minSize={0} maxSize={100} className="mode-settings-panel">
          <div className="mode-settings-container">
            {showCustomModeForm ? (
              <div className="custom-mode-form-container">
                <div className="custom-mode-form-header">
                  <h3>{editingMode ? '编辑自定义模式' : '添加自定义模式'}</h3>
                  <button
                    className="close-form-btn"
                    onClick={() => {
                      setShowCustomModeForm(false);
                      setEditingMode(null);
                      setNewModeName('');
                    }}
                  >
                    ×
                  </button>
                </div>
                <div className="custom-mode-form">
                  <div className="setting-group">
                    <label>模式名称</label>
                    <input
                      type="text"
                      value={newModeName}
                      onChange={(e) => setNewModeName(e.target.value)}
                      placeholder="输入自定义模式名称..."
                    />
                  </div>
                  <div className="form-actions">
                    <button
                      className="save-btn"
                      onClick={editingMode ? handleEditCustomModeUI : handleAddCustomModeUI}
                      disabled={!newModeName.trim()}
                    >
                      {editingMode ? '保存' : '添加'}
                    </button>
                    <button
                      className="cancel-btn"
                      onClick={() => {
                        setShowCustomModeForm(false);
                        setEditingMode(null);
                        setNewModeName('');
                      }}
                    >
                      取消
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="mode-settings-content">
                <div className="mode-settings-header">
                  <h3>{selectedModeDetail.name}模式设置</h3>
                  {selectedModeDetail.type === 'custom' && (
                    <div className="mode-actions">
                      <button
                        className="edit-mode-btn"
                        onClick={startEditCustomMode}
                        title="编辑模式名称"
                      >
                        <FontAwesomeIcon icon={faEdit} />
                      </button>
                      <button
                        className="delete-mode-btn"
                        onClick={() => setShowDeleteConfirm(true)}
                        title="删除模式"
                      >
                        <FontAwesomeIcon icon={faTrash} />
                      </button>
                    </div>
                  )}
                </div>
                {/* 标签页导航 */}
                <div className="settings-tabs">
                  <button
                    className={`tab-button ${activeTab === 'prompt' ? 'active' : ''}`}
                    onClick={() => setActiveTab('prompt')}
                  >
                    提示词设置
                  </button>
                  <button
                    className={`tab-button ${activeTab === 'ai' ? 'active' : ''}`}
                    onClick={() => setActiveTab('ai')}
                  >
                    聊天参数
                  </button>
                  <button
                    className={`tab-button ${activeTab === 'tools' ? 'active' : ''}`}
                    onClick={() => setActiveTab('tools')}
                  >
                    工具配置
                  </button>
                </div>
  
                {/* 标签页内容 */}
                {renderTabContent()}
              </div>
            )}
          </div>
        </Panel>
      </PanelGroup>

      {/* 删除确认对话框 */}
      {showDeleteConfirm && (
        <UnifiedModal
          message={`确定要删除自定义模式 "${selectedModeDetail.name}" 吗？此操作不可撤销。`}
          showCancelButton={true}
          confirmText="确定"
          cancelText="取消"
          onConfirm={handleDeleteCustomModeUI}
          onCancel={() => setShowDeleteConfirm(false)}
        />
      )}
      {/* 通知模态框 */}
      {notification.isOpen && (
        <UnifiedModal
          message={notification.message}
          onConfirm={handleNotificationClose}
          onCancel={handleNotificationClose}
        />
      )}
    </div>
  );
};

export default AgentPanel;
