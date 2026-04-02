/**
 * 主题相关类型定义
 */

/** 主题色配置项 */
export interface ThemeColorConfig {
  /** CSS 变量键名 */
  key: string;
  /** 显示名称 */
  name: string;
  /** 默认值 */
  defaultValue: string;
}

/** 主题模式 */
export type ThemeMode = 'dark' | 'light';

/** 完整主题类型 */
export type Theme = Record<string, string>;

/** 存储的配置格式 */
export interface StoredThemeConfig {
  mode: ThemeMode;
  colors: Record<string, string>;
}

/** 颜色选择器组件 Props */
export interface ThemeColorPickerProps {
  /** 颜色显示名称 */
  colorName: string;
  /** 当前颜色值 */
  currentValue: string;
  /** 默认颜色值 */
  defaultValue: string;
  /** 颜色变化回调 */
  onChange: (value: string) => void;
  /** 重置回调 */
  onReset: () => void;
}

/** 主题上下文类型 */
export interface ThemeContextType {
  /** 当前主题 */
  theme: Theme;
  /** 当前模式 */
  mode: ThemeMode;
  /** 设置模式 */
  setMode: (mode: ThemeMode) => void;
  /** 当前颜色值 */
  colors: Record<string, string>;
  /** 更新主题色 */
  updateThemeColor: (key: string, value: string) => void;
  /** 重置单个主题色 */
  resetThemeColor: (key: string) => void;
  /** 重置所有主题色 */
  resetAllThemeColors: () => void;
}
