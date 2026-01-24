import React from 'react';

/**
 * 统一的设置项组件
 * 提供一致的设置项布局和样式
 */
interface SettingGroupProps {
  title?: string;
  children?: React.ReactNode;
  description?: string;
  className?: string;
  collapsible?: boolean;
  defaultCollapsed?: boolean;
}

const SettingGroup = ({
  title,
  children,
  description,
  className = '',
  collapsible = false,
  defaultCollapsed = false
}: SettingGroupProps) => {
  const [isCollapsed, setIsCollapsed] = React.useState(defaultCollapsed);

  const toggleCollapse = () => {
    if (collapsible) {
      setIsCollapsed(!isCollapsed);
    }
  };

  return (
    <div className={`mb-6 border border-theme-gray1 rounded-medium p-4 bg-theme-black shadow-light ${className}`}>
      {title && (
        <div
          className={`flex justify-between items-center mb-2 pb-2 border-b border-theme-gray1 ${collapsible ? 'cursor-pointer transition-colors p-2 -m-2 mb-2 rounded-small hover:bg-theme-gray1' : ''}`}
          onClick={toggleCollapse}
        >
          <h4 className="m-0 text-base font-semibold text-theme-white">{title}</h4>
          {collapsible && (
            <span className={`text-theme-green text-xs transition-transform ${isCollapsed ? '' : 'rotate-90'}`}>
              ▶
            </span>
          )}
        </div>
      )}

      {description && !isCollapsed && (
        <div className="text-sm text-theme-white mb-4 leading-relaxed p-2 bg-theme-gray1 rounded-small border-l-3 border-theme-green">
          {description}
        </div>
      )}

      {!isCollapsed && (
        <div className="flex flex-col gap-4">
          {children}
        </div>
      )}
    </div>
  );
};

export default SettingGroup;
