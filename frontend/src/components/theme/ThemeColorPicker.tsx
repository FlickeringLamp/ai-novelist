import { useState } from 'react';
import { Wheel, hsvaToHex, hexToHsva } from '@uiw/react-color';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faRotateLeft } from '@fortawesome/free-solid-svg-icons';
import type { ThemeColorPickerProps } from '../../types';

function ThemeColorPicker({
  colorName,
  currentValue,
  defaultValue,
  onChange,
  onReset,
}: ThemeColorPickerProps) {
  const [showPicker, setShowPicker] = useState(false);
  const isDefault = currentValue.toLowerCase() === defaultValue.toLowerCase();

  // 将 hex 转换为 hsva 用于色盘显示
  const hsvaColor = hexToHsva(currentValue);

  return (
    <div className="flex items-center gap-4 p-3 bg-theme-gray1 rounded-md">
      {/* 颜色预览按钮 */}
      <div className="flex flex-col gap-1">
        <span className="text-theme-white text-sm font-medium">{colorName}</span>
        <button
          onClick={() => setShowPicker(!showPicker)}
          className="w-12 h-12 rounded-full border-2 border-theme-gray3 shadow-md transition-transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-theme-green"
          style={{ backgroundColor: currentValue }}
          title={`点击选择 ${colorName} 的颜色`}
        />
      </div>

      {/* 颜色值显示 */}
      <div className="flex-1 flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <span className="text-theme-white text-xs uppercase font-mono">
            {currentValue}
          </span>
          {!isDefault && (
            <span className="text-theme-white text-xs">(已修改)</span>
          )}
        </div>
        <div className="text-theme-white text-xs">
          默认: {defaultValue}
        </div>
      </div>

      {/* 重置按钮 */}
      <button
        onClick={onReset}
        disabled={isDefault}
        className={`p-2 rounded-md transition-colors ${
          isDefault
            ? 'text-theme-white opacity-50 cursor-not-allowed'
            : 'text-theme-white hover:bg-theme-gray2'
        }`}
        title="恢复默认值"
      >
        <FontAwesomeIcon icon={faRotateLeft} />
      </button>

      {/* 色盘弹窗 */}
      {showPicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-theme-gray1 p-6 rounded-lg shadow-2xl border border-theme-gray3">
            <div className="flex flex-col items-center gap-4">
              <h3 className="text-theme-white text-lg font-medium">
                选择 {colorName} 的颜色
              </h3>
              
              {/* 圆形色盘 */}
              <Wheel
                color={hsvaColor}
                onChange={(color) => onChange(color.hex)}
                width={200}
                height={200}
              />

              {/* 当前颜色预览 */}
              <div className="flex items-center gap-3">
                <div
                  className="w-8 h-8 rounded-full border border-theme-gray3"
                  style={{ backgroundColor: currentValue }}
                />
                <span className="text-theme-white font-mono text-sm">
                  {currentValue}
                </span>
              </div>

              {/* 操作按钮 */}
              <div className="flex gap-3">
                <button
                  onClick={() => setShowPicker(false)}
                  className="px-4 py-2 bg-theme-green text-theme-black rounded-md font-medium hover:opacity-90 transition-opacity"
                >
                  确定
                </button>
                <button
                  onClick={() => {
                    onChange(defaultValue);
                    setShowPicker(false);
                  }}
                  className="px-4 py-2 bg-theme-gray2 text-theme-white rounded-md hover:bg-theme-gray3 transition-colors border border-theme-white"
                >
                  恢复默认
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ThemeColorPicker;
