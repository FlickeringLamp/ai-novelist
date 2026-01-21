import { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faAngleLeft, faAngleRight } from '@fortawesome/free-solid-svg-icons';
import httpClient from '../../../utils/httpClient.js';

// 模式选择器组件
const ModeSelector = () => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [page, setPage] = useState(0);
  const [currentMode, setCurrentMode] = useState('outline');
  const [customModes, setCustomModes] = useState([]);
  const modesPerPage = 5;

  // 加载模式设置
  useEffect(() => {
    const loadModeSettings = async () => {
      try {
        // 加载当前模式
        const modeResponse = await httpClient.get(`/api/config/store?key=${encodeURIComponent('currentMode')}`);
        if (modeResponse) {
          setCurrentMode(modeResponse);
        }
        
        // 加载自定义模式
        const modesResponse = await httpClient.get(`/api/config/store?key=${encodeURIComponent('customModes')}`);
        if (modesResponse && Array.isArray(modesResponse)) {
          setCustomModes(modesResponse);
        }
      } catch (error) {
        console.error('加载模式设置失败:', error);
      }
    };
    
    loadModeSettings();
  }, []);

  // 内置模式定义
  const builtInModes = [
    { id: 'outline', name: '细纲', type: 'builtin' },
    { id: 'writing', name: '写作', type: 'builtin' },
    { id: 'adjustment', name: '调整', type: 'builtin' }
  ];

  // 获取所有模式（内置 + 自定义）
  const allModes = [
    ...builtInModes,
    ...(Array.isArray(customModes) ? customModes.map(mode => ({
      id: mode.id,
      name: mode.name,
      type: 'custom'
    })) : [])
  ];

  // 过滤模式
  const filteredModes = allModes.filter(mode =>
    mode.name.toLowerCase().includes(searchText.toLowerCase())
  );

  // 分页模式
  const startIndex = page * modesPerPage;
  const paginatedModes = filteredModes.slice(startIndex, startIndex + modesPerPage);
  const totalPages = Math.ceil(filteredModes.length / modesPerPage);

  // 获取当前选中模式的显示名称
  const getDisplayModeName = () => {
    if (!currentMode) return '选择模式';
    const mode = allModes.find(m => m.id === currentMode);
    return mode ? `${mode.name}模式` : '选择模式';
  };

  const handleModeSelect = async (modeId) => {
    setCurrentMode(modeId);
    
    // 保存到持久化存储
    try {
      await httpClient.post('/api/config/store', {
        key: 'currentMode',
        value: modeId
      });
      console.log(`[模式选择器] 已保存模式选择: ${modeId}`);
      
      // 触发自定义事件，通知其他组件模式已更改
      window.dispatchEvent(new CustomEvent('modeChanged', { detail: { mode: modeId } }));
    } catch (error) {
      console.error('[模式选择器] 保存模式选择失败:', error);
    }
    
    setIsExpanded(false);
    setSearchText('');
    setPage(0);
  };

  // 处理搜索框点击事件，阻止事件冒泡
  const handleSearchClick = (e) => {
    e.stopPropagation();
  };

  // 处理搜索框输入变化
  const handleSearchChange = (e) => {
    setSearchText(e.target.value);
    setPage(0);
  };

  // 点击外部关闭下拉菜单
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (isExpanded && !e.target.closest('.mode-selector-container')) {
        setIsExpanded(false);
        setSearchText('');
        setPage(0);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isExpanded]);

  return (
    <div className="relative flex w-full z-[100] box-border">
      <div
        className="flex items-center justify-center w-full p-2 p-2.5-[12px] bg-theme-black border border-theme-gray1 rounded-small cursor-pointer transition-all min-h-[36px] box-border hover:border-theme-green hover:bg-theme-gray1"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <span className="text-theme-white text-[14px] font-medium whitespace-nowrap overflow-hidden text-ellipsis w-full text-center">{getDisplayModeName()}</span>
        <span className="text-theme-white text-[12px] ml-2 transition-transform">{isExpanded ? '▲' : '▶'}</span>
      </div>

      {isExpanded && (
        <div className="absolute bottom-full left-[-10px] right-[-150px] bg-theme-black border border-theme-gray1 rounded-small shadow-deep z-[1000] max-h-[300px] flex flex-col mb-1 overflow-hidden">
          {/* 搜索输入框 */}
          <input
            type="text"
            placeholder="搜索模式..."
            value={searchText}
            onChange={handleSearchChange}
            onClick={handleSearchClick}
            className="w-full p-2.5 p-2.5-[12px] bg-transparent border-none border-b border-theme-gray1 text-theme-white text-[14px] outline-none box-border placeholder:text-theme-white"
            autoFocus
          />
          
          {/* 模式列表 */}
          <div className="flex-1 overflow-y-auto">
            {paginatedModes.map((mode) => (
              <div
                key={mode.id}
                className={`flex flex-col p-2.5 p-2.5-[12px] cursor-pointer transition-all border-b border-theme-gray1 ${currentMode === mode.id ? 'bg-theme-green/10 border-l-3 border-l-theme-green' : 'hover:bg-theme-gray1'}`}
                onClick={() => handleModeSelect(mode.id)}
              >
                <div className="font-medium text-theme-white text-[14px] mb-0.5">{mode.name}</div>
                <div className="text-[0.8em] text-theme-white">
                  {mode.type === 'custom' ? '自定义模式' : '内置模式'}
                </div>
              </div>
            ))}
          </div>

          {/* 分页控制 */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center p-2.5 border-t border-theme-gray1 bg-theme-gray1 min-h-[44px]">
              <button
                disabled={page === 0}
                onClick={() => setPage(page - 1)}
                className="bg-transparent border-none text-theme-white cursor-pointer p-1 p-2.5-[8px] rounded-small transition-all hover:bg-theme-gray1 disabled:text-theme-white disabled:cursor-not-allowed"
              >
                <FontAwesomeIcon icon={faAngleLeft} />
              </button>
              <span className="text-[0.8em] text-theme-white mx-3">
                {page + 1} / {totalPages}
              </span>
              <button
                disabled={page >= totalPages - 1}
                onClick={() => setPage(page + 1)}
                className="bg-transparent border-none text-theme-white cursor-pointer p-1 p-2.5-[8px] rounded-small transition-all hover:bg-theme-gray1 disabled:text-theme-white disabled:cursor-not-allowed"
              >
                <FontAwesomeIcon icon={faAngleRight} />
              </button>
            </div>
          )}

          {/* 搜索结果统计 */}
          {searchText && (
            <div className="p-2 p-2.5-[12px] text-[0.8em] text-theme-white text-center border-t border-theme-gray1 bg-theme-gray1">
              找到 {filteredModes.length} 个匹配的模式
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ModeSelector;
