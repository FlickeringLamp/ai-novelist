import { useState, useEffect } from 'react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSave, faTimes, faPlus, faEdit, faTrash } from '@fortawesome/free-solid-svg-icons';
import httpClient from '../../utils/httpClient.ts';
import useModeManager from './ModeManager.ts';
import UnifiedModal from '../others/UnifiedModal.tsx';
import ChatParameters from './parameterTab/ChatParameters.tsx';
import FileSelector from './FileSelector.tsx';
import ToolConfigTab from './toolTab/ToolConfigTab.tsx';
import type { Mode } from './ModeManager.ts';

/**
 * 统一的Agent面板组件 - 整合了原来的三个GeneralSettings文件的功能
 */
interface AgentPanelProps {
  isOpen?: boolean;
  onClose?: () => void;
}

const AgentPanel = ({ isOpen = true, onClose }: AgentPanelProps) => {
  // UI状态 - 专注于展示和交互
  const [selectedMode, setSelectedMode] = useState<string>('outline');
  const [searchText, setSearchText] = useState<string>('');
  const [showCustomModeForm, setShowCustomModeForm] = useState<boolean>(false);
  const [editingMode, setEditingMode] = useState<Mode | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<boolean>(false);
  const [newModeName, setNewModeName] = useState<string>('');
  const [activeTab, setActiveTab] = useState<string>('prompt');
  const [notification, setNotification] = useState({
    isOpen: false,
    message: '',
    success: false
  });

  // 模式配置状态
  const [customPrompts, setCustomPrompts] = useState<Record<string, string>>({});
  const [builtinModePrompts, setBuiltinModePrompts] = useState<Record<string, string>>({});
  const [additionalInfo, setAdditionalInfo] = useState<Record<string, any>>({});
  const [aiParameters, setAiParameters] = useState<Record<string, any>>({});
  const [toolConfigs, setToolConfigs] = useState<Record<string, any>>({});
  const [allModesList, setAllModesList] = useState<Mode[]>([]);

  // 使用模式管理模块 - 单一数据源
  const modeManager = useModeManager();

  // 加载模式配置
  const loadModeConfig = async () => {
    try {
      const [modeConfigData, aiParametersData] = await Promise.all([
        httpClient.get(`/api/config/store?key=${encodeURIComponent('mode')}`),
        httpClient.get(`/api/config/store?key=${encodeURIComponent('aiParameters')}`)
      ]);
      
      // 从 mode 配置中提取所有模式的提示词和附加信息
      const prompts: Record<string, string> = {};
      const additionalInfos: Record<string, any> = {};
      if (modeConfigData) {
        Object.keys(modeConfigData).forEach(modeId => {
          prompts[modeId] = modeConfigData[modeId]?.prompt || '';
          additionalInfos[modeId] = modeConfigData[modeId]?.additionalInfo || [];
        });
      }
      
      setCustomPrompts(prompts);
      setAdditionalInfo(additionalInfos);
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
  const handlePromptChange = async (mode: string, value: string) => {
    const updatedPrompts = {
      ...customPrompts,
      [mode]: value
    };
    setCustomPrompts(updatedPrompts);
    
    // 保存到后端 - 保存到 mode.{modeId}.prompt
    try {
      await httpClient.post('/api/config/store', {
        key: `mode.${mode}.prompt`,
        value: value
      });
    } catch (error) {
      console.error('保存提示词失败:', error);
    }
  };


  const handleAdditionalInfoChange = async (mode: string, value: any) => {
    const updatedAdditionalInfo = {
      ...additionalInfo,
      [mode]: value
    };
    console.log("配置了什么玩意",updatedAdditionalInfo)
    setAdditionalInfo(updatedAdditionalInfo);
    
    // 保存到后端 - 保存到 mode.{modeId}.additionalInfo
    try {
      await httpClient.post('/api/config/store', {
        key: `mode.${mode}.additionalInfo`,
        value: value
      });
    } catch (error) {
      console.error('保存附加信息失败:', error);
    }
  };

  const handleAiParametersChange = async (mode: string, newParameters: any) => {
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
  const handleToolConfigChange = async (mode: string, newConfig: any) => {
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
      
      // 保存到后端 - 提示词和附加信息已通过 handlePromptChange 和 handleAdditionalInfoChange 实时保存，这里只保存AI参数
      await httpClient.post('/api/config/store', { key: 'aiParameters', value: aiParameters });
      
      // 通知保存成功
      showNotification('通用设置保存成功！', true);
    } catch (error) {
      console.error('保存通用设置失败:', error);
      showNotification('通用设置保存失败，请重试。', false);
    }
  };

  // 通知处理
  const showNotification = (message: string, success: boolean = true) => {
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
  const getModeDisplayName = (mode: string) => {
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
          name: newModeName.trim(),
          type: 'custom',
          description: '自定义模式'
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
        await modeManager.editCustomMode(editingMode!.id, {
          ...editingMode!,
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
        
        // 清理自定义模式的配置
        try {
          await httpClient.post('/api/config/store', {
            key: `mode.${selectedMode}`,
            value: null
          });
        } catch (error) {
          console.error('清理模式配置失败:', error);
        }
        
        await modeManager.cleanupModeSettings(selectedMode);
        setShowDeleteConfirm(false);
        
        // 重新加载模式列表和配置
        await Promise.all([
          loadAllModes(),
          loadModeConfig()
        ]);
        
        // 删除后切换到第一个模式
        const allModes = getAllModes();
        if (allModes.length > 0 && allModes[0]) {
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
    const customMode = modeManager.customModes.find((m: Mode) => m.id === selectedMode);
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
          <div className="flex-1 overflow-y-auto p-3">
            <ChatParameters
              aiParameters={aiParameters}
              onParametersChange={handleAiParametersChange}
              mode={selectedMode}
            />
          </div>
        );
      case 'tools':
        return (
          <div className="flex-1 overflow-y-auto p-3">
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
          <div className="flex flex-col gap-4 p-3">
            {/* 提示词 */}
            <div className="flex flex-col gap-2">
              <h4 className="text-theme-white text-[14px] font-medium">提示词:</h4>
              <textarea
                value={selectedModeDetail.customPrompt}
                onChange={(e) => handlePromptChange(selectedMode, e.target.value)}
                placeholder={`输入${selectedModeDetail.name}模式的提示词...`}
                rows={4}
                className="w-full p-2.5 bg-theme-gray3 border border-theme-gray1 rounded-small text-theme-white text-[14px] outline-none resize-none placeholder:text-theme-gray1"
              />
            </div>

            {/* 附加文件框 */}
            <div className="flex flex-col gap-2">
              <h4 className="text-theme-white text-[14px] font-medium">附加文件:</h4>
              <div className="flex flex-col gap-2">
                <FileSelector
                  onFileContentAdd={(content) => {
                    const newFile = {
                      content: content
                    };
                    handleAdditionalInfoChange(selectedMode, newFile);
                  }}
                />
                
                {/* 显示已添加的文件 */}
                <div className="flex flex-col gap-2">
                  <h5 className="text-theme-white text-[12px]">已添加的文件:</h5>
                  {selectedModeDetail.additionalInfo && selectedModeDetail.additionalInfo.content ? (
                    <div className="flex items-center justify-between p-2.5 bg-theme-gray1 border border-theme-gray1 rounded-small">
                      <span className="text-theme-white text-[12px] truncate flex-1">{selectedModeDetail.additionalInfo.content.path}</span>
                      <button
                        className="flex items-center justify-center w-6 h-6 bg-transparent border-none text-theme-white cursor-pointer text-[12px] hover:text-red-500 transition-colors"
                        onClick={() => {
                          handleAdditionalInfoChange(selectedMode, {});
                        }}
                      >
                        <FontAwesomeIcon icon={faTimes} />
                      </button>
                    </div>
                  ) : (
                    <div className="text-theme-white text-[12px] p-2.5">暂无附加文件</div>
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
    <div className="flex flex-col h-full bg-theme-black border border-theme-gray1 rounded-small overflow-hidden">
      {/* 头部操作栏 */}
      <div className="flex items-center justify-between p-3 border-b border-theme-gray1 bg-theme-gray1">
        <h2 className="text-theme-white text-[16px] font-medium m-0">Agent设置面板</h2>
        <div className="flex gap-2">
          <button className="flex items-center gap-2 px-3 py-2 bg-theme-green text-theme-white border-none rounded-small cursor-pointer text-[14px] transition-all hover:bg-theme-green/80" onClick={handleSave}>
            <FontAwesomeIcon icon={faSave} /> 保存
          </button>
          {onClose && (
            <button className="flex items-center gap-2 px-3 py-2 bg-theme-gray1 text-theme-white border-none rounded-small cursor-pointer text-[14px] transition-all hover:bg-theme-gray1/80" onClick={onClose}>
              <FontAwesomeIcon icon={faTimes} /> 关闭
            </button>
          )}
        </div>
      </div>

      <PanelGroup direction="horizontal" className="flex-1">
        {/* 左侧模式列表 */}
        <Panel defaultSize={25} minSize={0} maxSize={100}>
          <div className="flex flex-col h-full bg-theme-black">
            <div className="p-3 border-b border-theme-gray1">
              <h3 className="text-theme-white text-[14px] font-medium mb-2">模式设置</h3>
              <div className="flex">
                <input
                  type="text"
                  placeholder="搜索模式..."
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  className="flex-1 p-2.5 bg-transparent border border-theme-gray1 rounded-small text-theme-white text-[12px] outline-none placeholder:text-theme-white"
                />
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto">
              {filteredModes.map(mode => (
                <div
                  key={mode.id}
                  className={`flex items-center p-2.5 border-b border-theme-gray1 cursor-pointer transition-all ${selectedMode === mode.id ? 'bg-theme-green/10 border-l-3 border-l-theme-green' : 'hover:bg-theme-gray1'}`}
                  onClick={() => setSelectedMode(mode.id)}
                >
                  <div className="flex flex-col gap-1">
                    <div className="text-theme-white text-[14px] font-medium">{mode.name}</div>
                    <div className="text-theme-white text-[12px]">
                      {mode.type === 'custom' ? '自定义模式' : '内置模式'}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="p-2.5 border-t border-theme-gray1">
              <button
                className="w-full flex items-center justify-center gap-2 p-2.5 bg-theme-green text-theme-white border-none rounded-small cursor-pointer text-[12px] transition-all hover:bg-theme-green/80"
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
        <PanelResizeHandle className="w-1 bg-theme-gray1 hover:bg-theme-green cursor-col-resize transition-colors" />

        {/* 右侧设置面板 */}
        <Panel minSize={0} maxSize={100}>
          <div className="flex flex-col h-full bg-theme-black">
            {showCustomModeForm ? (
              <div className="flex flex-col h-full p-3">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-theme-white text-[14px] font-medium">{editingMode ? '编辑自定义模式' : '添加自定义模式'}</h3>
                  <button
                    className="flex items-center justify-center w-6 h-6 bg-transparent border-none text-theme-white cursor-pointer text-[20px] hover:text-theme-white transition-colors"
                    onClick={() => {
                      setShowCustomModeForm(false);
                      setEditingMode(null);
                      setNewModeName('');
                    }}
                  >
                    ×
                  </button>
                </div>
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col gap-2">
                    <label className="text-theme-white text-[12px]">模式名称</label>
                    <input
                      type="text"
                      value={newModeName}
                      onChange={(e) => setNewModeName(e.target.value)}
                      placeholder="输入自定义模式名称..."
                      className="w-full p-2.5 bg-theme-gray1 border border-theme-gray1 rounded-small text-theme-white text-[14px] outline-none placeholder:text-theme-white"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      className="flex-1 p-2.5 bg-theme-green text-theme-white border-none rounded-small cursor-pointer text-[14px] transition-all hover:bg-theme-green/80 disabled:bg-theme-gray1 disabled:text-theme-white disabled:cursor-not-allowed"
                      onClick={editingMode ? handleEditCustomModeUI : handleAddCustomModeUI}
                      disabled={!newModeName.trim()}
                    >
                      {editingMode ? '保存' : '添加'}
                    </button>
                    <button
                      className="flex-1 p-2.5 bg-theme-gray1 text-theme-white border-none rounded-small cursor-pointer text-[14px] transition-all hover:bg-theme-gray1/80"
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
              <div className="flex flex-col h-full">
                <div className="flex items-center justify-between p-3 border-b border-theme-gray1">
                  <h3 className="text-theme-white text-[14px] font-medium">{selectedModeDetail.name}模式设置</h3>
                  {selectedModeDetail.type === 'custom' && (
                    <div className="flex gap-1">
                      <button
                        className="flex items-center justify-center w-6 h-6 bg-transparent border-none text-theme-white cursor-pointer text-[12px] hover:text-theme-green transition-colors"
                        onClick={startEditCustomMode}
                        title="编辑模式名称"
                      >
                        <FontAwesomeIcon icon={faEdit} />
                      </button>
                      <button
                        className="flex items-center justify-center w-6 h-6 bg-transparent border-none text-theme-white cursor-pointer text-[12px] hover:text-red-500 transition-colors"
                        onClick={() => setShowDeleteConfirm(true)}
                        title="删除模式"
                      >
                        <FontAwesomeIcon icon={faTrash} />
                      </button>
                    </div>
                  )}
                </div>
                {/* 标签页导航 */}
                <div className="flex border-b border-theme-gray1">
                  <button
                    className={`flex-1 p-2.5 bg-transparent border-none text-[12px] cursor-pointer transition-all ${activeTab === 'prompt' ? 'text-theme-green border-b-2 border-b-theme-green' : 'text-theme-white hover:text-theme-white'}`}
                    onClick={() => setActiveTab('prompt')}
                  >
                    提示词设置
                  </button>
                  <button
                    className={`flex-1 p-2.5 bg-transparent border-none text-[12px] cursor-pointer transition-all ${activeTab === 'ai' ? 'text-theme-green border-b-2 border-b-theme-green' : 'text-theme-white hover:text-theme-white'}`}
                    onClick={() => setActiveTab('ai')}
                  >
                    聊天参数
                  </button>
                  <button
                    className={`flex-1 p-2.5 bg-transparent border-none text-[12px] cursor-pointer transition-all ${activeTab === 'tools' ? 'text-theme-green border-b-2 border-b-theme-green' : 'text-theme-white hover:text-theme-white'}`}
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
          buttons={[
            { text: '确定', onClick: handleDeleteCustomModeUI, className: 'bg-theme-green' },
            { text: '取消', onClick: () => setShowDeleteConfirm(false), className: 'bg-theme-gray3' }
          ]}
        />
      )}
      {/* 通知模态框 */}
      {notification.isOpen && (
        <UnifiedModal
          message={notification.message}
          buttons={[
            { text: '确定', onClick: handleNotificationClose, className: 'bg-theme-green' }
          ]}
        />
      )}
    </div>
  );
};

export default AgentPanel;
