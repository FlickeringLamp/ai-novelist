import { useState, useEffect } from 'react';
import { Panel } from 'react-resizable-panels';
import { useSelector, useDispatch } from 'react-redux';
import type { RootState } from '../../store/store';
import { setAllModesData, setAvailableTools, setFileTree } from '../../store/mode';
import httpClient from '../../utils/httpClient';

type TabType = 'prompt' | 'params' | 'tools';

const ModeDetailPanel = () => {
  const dispatch = useDispatch();

  // 从 Redux 获取状态
  const selectedModeId = useSelector((state: RootState) => state.modeSlice.selectedModeId);
  const allModesData = useSelector((state: RootState) => state.modeSlice.allModesData);
  const availableTools = useSelector((state: RootState) => state.modeSlice.availableTools);
  const fileTree = useSelector((state: RootState) => state.modeSlice.fileTree);

  const [activeTab, setActiveTab] = useState<TabType>('prompt');
  const [prompt, setPrompt] = useState('');
  const [additionalInfo, setAdditionalInfo] = useState<string[]>([]);
  const [temperature, setTemperature] = useState(0.7);
  const [topP, setTopP] = useState(0.7);
  const [maxTokens, setMaxTokens] = useState(4096);
  const [enabledTools, setEnabledTools] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // 获取当前选中的模式数据
  const currentModeData = selectedModeId ? allModesData[selectedModeId] : null;

  // 加载当前选中的模式的数据
  useEffect(() => {
    if (!selectedModeId) {
      setPrompt('');
      setAdditionalInfo([]);
      setTemperature(0.7);
      setTopP(0.7);
      setMaxTokens(4096);
      setEnabledTools([]);
      return;
    }
    if (currentModeData) {
      setPrompt(currentModeData.prompt || '');
      setAdditionalInfo(currentModeData.additionalInfo || []);
      setTemperature(currentModeData.temperature ?? 0.7);
      setTopP(currentModeData.top_p ?? 0.7);
      setMaxTokens(currentModeData.max_tokens ?? 4096);
      setEnabledTools(currentModeData.tools || []);
    } else {
      setPrompt('');
      setAdditionalInfo([]);
      setTemperature(0.7);
      setTopP(0.7);
      setMaxTokens(4096);
      setEnabledTools([]);
    }
  }, [selectedModeId, currentModeData]);

  // 挂载时获取可用工具和文件树
  useEffect(() => {
    const fetchData = async () => {
      try {
        // 获取可用工具
        const toolsResult = await httpClient.get('/api/mode/tool/available-tools');
        if (toolsResult) {
          dispatch(setAvailableTools(toolsResult));
        }

        // 获取文件树
        const treeResult = await httpClient.get('/api/file/tree');
        if (treeResult) {
          dispatch(setFileTree(treeResult));
        }
      } catch (error) {
        console.error('获取数据失败:', error);
      }
    };
    fetchData();
  }, []);

  // 保存提示词
  const savePrompt = async () => {
    if (!selectedModeId) return;
    try {
      await httpClient.put(`/api/mode/custom-modes/${selectedModeId}`, {
        prompt: prompt
      });
      // 刷新模式列表
      const modesResult = await httpClient.get('/api/mode/modes');
      dispatch(setAllModesData(modesResult));
    } catch (error) {
      setError(`保存提示词失败: ${(error as Error).message}`);
    }
  };

  // 保存附件信息
  const saveAdditionalInfo = async (info?: string[]) => {
    if (!selectedModeId) return;
    try {
      const infoToSave = info ?? additionalInfo;
      await httpClient.put(`/api/mode/custom-modes/${selectedModeId}`, {
        additionalInfo: infoToSave
      });
      // 刷新模式列表
      const modesResult = await httpClient.get('/api/mode/modes');
      dispatch(setAllModesData(modesResult));
    } catch (error) {
      setError(`保存附件失败: ${(error as Error).message}`);
    }
  };

  // 保存参数
  const saveParams = async () => {
    if (!selectedModeId) return;
    try {
      await httpClient.put(`/api/mode/custom-modes/${selectedModeId}`, {
        temperature: temperature,
        top_p: topP,
        max_tokens: maxTokens || 4096
      });
      // 刷新模式列表
      const modesResult = await httpClient.get('/api/mode/modes');
      dispatch(setAllModesData(modesResult));
    } catch (error) {
      setError(`保存参数失败: ${(error as Error).message}`);
    }
  };

  // 保存工具配置
  const saveTools = async (tools?: string[]) => {
    if (!selectedModeId) return;
    try {
      const toolsToSave = tools ?? enabledTools;
      await httpClient.put(`/api/mode/custom-modes/${selectedModeId}`, {
        tools: toolsToSave
      });
      // 刷新模式列表
      const modesResult = await httpClient.get('/api/mode/modes');
      dispatch(setAllModesData(modesResult));
    } catch (error) {
      setError(`保存工具配置失败: ${(error as Error).message}`);
    }
  };

  // 递归提取文件路径（只提取文件，不包含文件夹）
  const extractFilePaths = (tree: any[]): string[] => {
    const paths: string[] = [];
    for (const item of tree) {
      // 只有当 isFolder 为 false 时，才视为文件
      if (item.isFolder === false) {
        paths.push(item.id);
      } else if (item.children && item.children.length > 0) {
        // 递归处理文件夹的子节点
        paths.push(...extractFilePaths(item.children));
      }
    }
    return paths;
  };

  // 获取所有文件路径
  const allFilePaths = extractFilePaths(fileTree);

  // 根据搜索查询过滤文件路径
  const filteredFilePaths = searchQuery
    ? allFilePaths.filter(path => path.toLowerCase().includes(searchQuery.toLowerCase()))
    : allFilePaths;

  // 切换工具选中状态
  const toggleTool = (toolName: string) => {
    const currentTools = Array.isArray(enabledTools) ? enabledTools : [];
    const newTools = currentTools.includes(toolName)
      ? currentTools.filter(t => t !== toolName)
      : [...currentTools, toolName];
    setEnabledTools(newTools);
    // 即时保存，直接传递最新值
    setTimeout(() => {
      saveTools(newTools);
    }, 0);
  };

  // 切换附件选中状态
  const toggleAttachment = (filePath: string) => {
    const currentInfo = Array.isArray(additionalInfo) ? additionalInfo : [];
    const newInfo = currentInfo.includes(filePath)
      ? currentInfo.filter(p => p !== filePath)
      : [...currentInfo, filePath];
    setAdditionalInfo(newInfo);
    // 即时保存，直接传递最新值
    setTimeout(() => {
      saveAdditionalInfo(newInfo);
    }, 0);
  };

  return (
    <Panel className='border border-theme-gray1 flex flex-col h-full'>
      {selectedModeId && (
        <>
          {/* 标签栏 */}
          <div className="flex border-b border-theme-gray3 h-[5%]">
            <button
              onClick={() => setActiveTab('prompt')}
              className={`flex-1 px-4 py-2 text-sm ${
                activeTab === 'prompt'
                  ? 'bg-theme-gray2 text-theme-green border-b-2 border-theme-green'
                  : 'text-theme-white hover:bg-theme-gray2'
              }`}
            >
              提示词
            </button>
            <button
              onClick={() => setActiveTab('params')}
              className={`flex-1 px-4 py-2 text-sm ${
                activeTab === 'params'
                  ? 'bg-theme-gray2 text-theme-green border-b-2 border-theme-green'
                  : 'text-theme-white hover:bg-theme-gray2'
              }`}
            >
              参数
            </button>
            <button
              onClick={() => setActiveTab('tools')}
              className={`flex-1 px-4 py-2 text-sm ${
                activeTab === 'tools'
                  ? 'bg-theme-gray2 text-theme-green border-b-2 border-theme-green'
                  : 'text-theme-white hover:bg-theme-gray2'
              }`}
            >
              工具
            </button>
          </div>

          {/* 内容区域 */}
          <div className="flex-1 overflow-y-auto p-4">
            {error && (
              <div className="mb-4 p-2 rounded bg-theme-black text-theme-green">
                {error}
              </div>
            )}

            {activeTab === 'prompt' && (
              <div className="space-y-4">
                {/* 提示词输入框 */}
                <div>
                  <label className="block text-theme-white text-sm mb-2">提示词</label>
                  <textarea
                    className="w-full h-48 p-2 bg-theme-gray2 text-theme-white border border-theme-gray3 rounded focus:outline-none focus:border-theme-green resize-none"
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    onBlur={savePrompt}
                    placeholder="请输入提示词"
                  />
                </div>

                {/* 附件栏 */}
                <div>
                  <label className="block text-theme-white text-sm mb-2">附件</label>
                  {/* 搜索框 */}
                  <input
                    type="text"
                    placeholder="搜索文件..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full mb-2 p-2 bg-theme-gray2 text-theme-white border border-theme-gray3 rounded focus:outline-none focus:border-theme-green text-sm"
                  />
                  <div className="bg-theme-gray2 border border-theme-gray3 rounded p-2 max-h-64 overflow-y-auto">
                    {filteredFilePaths.length === 0 ? (
                      <div className="text-theme-gray4 text-sm">{searchQuery ? '未找到匹配的文件' : '暂无文件'}</div>
                    ) : (
                      filteredFilePaths.map((filePath, index) => (
                        <div key={index} className="flex items-center py-1">
                          <input
                            type="checkbox"
                            id={`file-${index}`}
                            checked={Array.isArray(additionalInfo) ? additionalInfo.includes(filePath) : false}
                            onChange={() => toggleAttachment(filePath)}
                            className="mr-2 accent-theme-green"
                          />
                          <label
                            htmlFor={`file-${index}`}
                            className="text-theme-white text-sm cursor-pointer flex-1"
                          >
                            {filePath}
                          </label>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'params' && (
              <div className="space-y-6">
                {/* 温度 */}
                <div>
                  <label className="block text-theme-white text-sm mb-2">
                    温度: {temperature.toFixed(2)}
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="2"
                    step="0.1"
                    value={temperature}
                    onChange={(e) => setTemperature(parseFloat(e.target.value))}
                    onBlur={saveParams}
                    className="w-full accent-theme-green"
                  />
                </div>

                {/* Top P */}
                <div>
                  <label className="block text-theme-white text-sm mb-2">
                    Top P: {topP.toFixed(2)}
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={topP}
                    onChange={(e) => setTopP(parseFloat(e.target.value))}
                    onBlur={saveParams}
                    className="w-full accent-theme-green"
                  />
                </div>

                {/* 最大 Tokens，清空内容时为NaN，错误警告是正常的。设置了默认值则无法将输入框清除干净 */}
                <div>
                  <label className="block text-theme-white text-sm mb-2">最大 Tokens</label>
                  <input
                    type="number"
                    value={maxTokens}
                    onChange={(e) => setMaxTokens(parseInt(e.target.value))}
                    onBlur={saveParams}
                    className="w-full p-2 bg-theme-gray2 text-theme-white border border-theme-gray3 rounded focus:outline-none focus:border-theme-green"
                  />
                </div>
              </div>
            )}

            {activeTab === 'tools' && (
              <div className="h-full flex flex-col">
                <div className="bg-theme-gray2 border border-theme-gray3 rounded p-2 flex-1 overflow-y-auto">
                  {Object.keys(availableTools).length === 0 ? (
                    <div className="text-theme-gray4 text-sm">暂无可用工具</div>
                  ) : (
                    Object.entries(availableTools).map(([toolKey, toolInfo], index) => (
                      <div key={index} className="flex items-start py-2 border-b border-theme-gray3 last:border-0">
                        <input
                          type="checkbox"
                          id={`tool-${index}`}
                          checked={Array.isArray(enabledTools) ? enabledTools.includes(toolKey) : false}
                          onChange={() => toggleTool(toolKey)}
                          className="mr-2 mt-1 accent-theme-green"
                        />
                        <div className="flex-1">
                          <label
                            htmlFor={`tool-${index}`}
                            className="text-theme-white text-sm cursor-pointer block font-medium"
                          >
                            {toolInfo.name}
                          </label>
                          <p className="text-theme-gray4 text-xs mt-1">
                            {toolInfo.description}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </Panel>
  );
};

export default ModeDetailPanel;
