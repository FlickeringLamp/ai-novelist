import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSearch, faList, faSave, faTerminal } from '@fortawesome/free-solid-svg-icons';
import StatusLogo from './StatusLogo';
import WindowControls from './WindowControls';
import type { TopActionBarProps } from '@/types';

function TopActionBar({ 
  isLeftPanelCollapsed, 
  leftPanelContent, 
  onToggleCollapse, 
  onLeftPanelContentChange,
  isTerminalVisible = false,
  onToggleTerminal
}: TopActionBarProps) {
  return (
    <div className="h-[3%] bg-theme-black flex items-center justify-between px-0 select-none window-drag-region border-b border-theme-gray2">
      <div className="flex items-center px-2 gap-3" style={{ WebkitAppRegion: 'no-drag' } as any}>
        <StatusLogo
          isCollapsed={isLeftPanelCollapsed}
          onToggleCollapse={onToggleCollapse}
        />
        {/* 左侧面板模式切换按钮组 - 折叠时隐藏 */}
        {!isLeftPanelCollapsed && (
          <div className="flex items-center gap-1">
            {/* 章节列表按钮 */}
            <button
              onClick={() => onLeftPanelContentChange('chapter')}
              className={`p-2 hover:bg-theme-gray3 rounded transition-colors ${leftPanelContent === 'chapter' ? 'text-theme-green' : 'text-theme-white'}`}
              title="章节列表"
            >
              <FontAwesomeIcon icon={faList} className="text-sm" />
            </button>
            {/* 搜索按钮 */}
            <button
              onClick={() => onLeftPanelContentChange('search')}
              className={`p-2 hover:bg-theme-gray3 rounded transition-colors ${leftPanelContent === 'search' ? 'text-theme-green' : 'text-theme-white'}`}
              title="搜索文件"
            >
              <FontAwesomeIcon icon={faSearch} className="text-sm" />
            </button>
            {/* 存档点按钮 */}
            <button
              onClick={() => onLeftPanelContentChange('checkpoint')}
              className={`p-2 hover:bg-theme-gray3 rounded transition-colors ${leftPanelContent === 'checkpoint' ? 'text-theme-green' : ''}`}
              title="存档点"
            >
              <FontAwesomeIcon icon={faSave} className="text-sm" />
            </button>
          </div>
        )}
      </div>
      
      {/* 中间：终端切换按钮 */}
      <div className="flex items-center" style={{ WebkitAppRegion: 'no-drag' } as any}>
        {onToggleTerminal && (
          <button
            onClick={onToggleTerminal}
            className={`px-3 py-1 rounded text-xs flex items-center gap-1 transition-colors ${
              isTerminalVisible 
                ? 'bg-theme-green text-theme-black' 
                : 'text-theme-gray5 hover:text-theme-white hover:bg-theme-gray2'
            }`}
            title="切换终端 (Ctrl+`)"
          >
            <FontAwesomeIcon icon={faTerminal} />
            <span>终端</span>
          </button>
        )}
      </div>
      
      <WindowControls />
    </div>
  );
}

export default TopActionBar;
