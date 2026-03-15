import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSearch, faList, faSave } from '@fortawesome/free-solid-svg-icons';
import StatusLogo from './StatusLogo';
import WindowControls from './WindowControls';

interface TopActionBarProps {
  isLeftPanelCollapsed: boolean;
  leftPanelContent: 'chapter' | 'search' | 'checkpoint';
  onToggleCollapse: () => void;
  onLeftPanelContentChange: (content: 'chapter' | 'search' | 'checkpoint') => void;
}

function TopActionBar({ isLeftPanelCollapsed, leftPanelContent, onToggleCollapse, onLeftPanelContentChange }: TopActionBarProps) {
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
      <WindowControls />
    </div>
  );
}

export default TopActionBar;
