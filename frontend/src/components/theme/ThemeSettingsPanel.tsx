import { useState } from 'react';
import { useTheme, customizableColors } from '../../context/ThemeContext';
import ThemeColorPicker from './ThemeColorPicker';
import UnifiedModal from '../others/UnifiedModal';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faRotateLeft, faXmark } from '@fortawesome/free-solid-svg-icons';

interface ThemeSettingsPanelProps {
  onClose?: () => void;
}

function ThemeSettingsPanel({ onClose }: ThemeSettingsPanelProps) {
  const {
    theme,
    mode,
    setMode,
    colors,
    updateThemeColor,
    resetThemeColor,
    resetAllThemeColors,
  } = useTheme();

  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const handleResetAll = () => {
    setShowResetConfirm(true);
  };

  const confirmResetAll = () => {
    resetAllThemeColors();
    setShowResetConfirm(false);
  };

  const toggleMode = () => {
    setMode(mode === 'dark' ? 'light' : 'dark');
  };

  return (
    <div className="h-full flex flex-col bg-theme-black">
      {/* 头部 */}
      <div className="flex items-center justify-between p-4 border-b border-theme-gray3">
        <h2 className="text-theme-white text-xl font-bold">主题色设置</h2>
        <div className="flex items-center gap-3">
          {/* 日/夜模式切换 */}
          <button
            onClick={toggleMode}
            className="flex items-center gap-2"
            title={mode === 'dark' ? '切换到日间模式' : '切换到夜间模式'}
          >
            <span className="text-theme-white text-sm">
              {mode === 'dark' ? '夜间' : '日间'}
            </span>
            <div
              className={`relative w-12 h-6 rounded-full transition-colors duration-300 ${
                mode === 'dark' ? 'bg-theme-green' : 'bg-theme-gray3'
              }`}
            >
              <div
                className={`absolute top-0.5 w-5 h-5 rounded-full bg-theme-white shadow-md transition-transform duration-300 ${
                  mode === 'dark' ? 'translate-x-6' : 'translate-x-0.5'
                }`}
              />
            </div>
          </button>
          <button
            onClick={handleResetAll}
            className="p-2 text-theme-white hover:opacity-80 transition-opacity"
            title="恢复全部默认"
          >
            <FontAwesomeIcon icon={faRotateLeft} className="text-lg" />
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="p-2 text-theme-white hover:opacity-80 transition-opacity"
              title="关闭"
            >
              <FontAwesomeIcon icon={faXmark} className="text-lg" />
            </button>
          )}
        </div>
      </div>

      {/* 颜色列表 */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="flex flex-col gap-3">
          {customizableColors.map((config) => (
            <ThemeColorPicker
              key={config.key}
              colorName={config.name}
              currentValue={colors[config.key] || config.defaultValue}
              defaultValue={config.defaultValue}
              onChange={(value) => updateThemeColor(config.key, value)}
              onReset={() => resetThemeColor(config.key)}
            />
          ))}
        </div>

      </div>

      {/* 恢复默认确认弹窗 */}
      {showResetConfirm && (
        <UnifiedModal
          title="确认恢复"
          message="确定要恢复所有主题色为默认值吗？"
          buttons={[
            { text: '确定', onClick: confirmResetAll, className: 'bg-theme-green' },
            { text: '取消', onClick: () => setShowResetConfirm(false), className: 'bg-theme-gray3' }
          ]}
        />
      )}
    </div>
  );
}

export default ThemeSettingsPanel;
