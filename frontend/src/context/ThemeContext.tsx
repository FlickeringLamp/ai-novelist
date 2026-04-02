import { createContext, useContext, useState, useEffect, type ReactNode, useMemo } from 'react';
import httpClient from '../utils/httpClient';
import type {
  ThemeColorConfig,
  ThemeMode,
  Theme,
  StoredThemeConfig,
  ThemeContextType,
} from '../types';

// 夜间模式默认灰阶+黑白
const nightModeDefaults: Record<string, string> = {
  black: '#000000',    // 墨 - 项目底色
  gray1: '#111111',    // 焦
  gray2: '#333333',    // 浓
  gray3: '#666666',    // 重
  gray4: '#999999',    // 淡
  gray5: '#cccccc',    // 清
  white: '#FFFFFF',    // 白（字体色）
};

// 日间模式默认灰阶+黑白
const dayModeDefaults: Record<string, string> = {
  black: '#ffffffe3',
  gray1: '#f3eee2',
  gray2: '#f0e8da',
  gray3: '#f3ecafef',
  gray4: '#ecda9c',
  gray5: '#f8ce42',
  white: '#000000',
};

// 其他主题色默认值
const otherDefaults: Record<string, string> = {
  green: '#34eb5c',    // 主题绿
  green1: '#2ad541',   // 主题青
  red: '#ff0000',      // 红色
  yellow: '#eab308',   // 黄色
};

// 合并所有默认值
const allDefaults: Record<string, string> = {
  ...nightModeDefaults,
  ...otherDefaults,
};

// 面板上可编辑的主题色配置（黑、白、灰阶由日/夜模式自动管理）
export const customizableColors: ThemeColorConfig[] = [
  { key: 'green', name: '主题绿', defaultValue: '#34eb5c' },
  { key: 'green1', name: '主题青', defaultValue: '#2ad541' },
  { key: 'red', name: '红色', defaultValue: '#ff0000' },
  { key: 'yellow', name: '黄色', defaultValue: '#eab308' },
];

// 灰阶颜色键名列表
const grayKeys = ['black', 'gray1', 'gray2', 'gray3', 'gray4', 'gray5', 'white'];

const CONFIG_KEY = 'theme.config';

const ThemeContext = createContext<ThemeContextType>({
  theme: allDefaults,
  mode: 'dark',
  setMode: () => {},
  colors: allDefaults,
  updateThemeColor: () => {},
  resetThemeColor: () => {},
  resetAllThemeColors: () => {},
});

// 主题提供者组件
export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const [mode, setModeState] = useState<ThemeMode>('dark');
  const [colors, setColors] = useState<Record<string, string>>(allDefaults);
  const [isLoaded, setIsLoaded] = useState(false);

  // 当前主题（就是 colors）
  const theme = useMemo(() => ({ ...colors }), [colors]);

  // 从后端加载主题配置
  useEffect(() => {
    const loadThemeFromBackend = async () => {
      try {
        const response = await httpClient.get(`/api/config/store?key=${encodeURIComponent(CONFIG_KEY)}`) as StoredThemeConfig;
        if (response && typeof response === 'object') {
          if (response.mode) {
            setModeState(response.mode);
          }
          if (response.colors) {
            setColors(prev => ({ ...prev, ...response.colors }));
          }
        }
      } catch (error) {
        console.log('Failed to load theme from backend, using default theme');
      } finally {
        setIsLoaded(true);
      }
    };

    loadThemeFromBackend();
  }, []);

  // 应用主题到 CSS 变量
  useEffect(() => {
    const root = document.documentElement;
    Object.entries(colors).forEach(([key, value]) => {
      root.style.setProperty(`--color-${key}`, value);
    });
  }, [colors]);

  // 保存到后端
  useEffect(() => {
    if (!isLoaded) return;

    const saveTheme = async () => {
      try {
        await httpClient.post('/api/config/store', {
          key: CONFIG_KEY,
          value: {
            mode,
            colors,
          } satisfies StoredThemeConfig,
        });
      } catch (error) {
        console.error('Failed to save theme to backend:', error);
      }
    };

    saveTheme();
  }, [mode, colors, isLoaded]);

  // 切换日/夜模式 - 只覆盖灰阶+黑白的值
  const setMode = (newMode: ThemeMode) => {
    setModeState(newMode);
    setColors(prev => {
      const newColors = { ...prev };
      const grayDefaults = newMode === 'dark' ? nightModeDefaults : dayModeDefaults;
      // 只覆盖灰阶颜色
      grayKeys.forEach(key => {
        if (grayDefaults[key]) {
          newColors[key] = grayDefaults[key];
        }
      });
      return newColors;
    });
  };

  // 更新颜色
  const updateThemeColor = (key: string, value: string) => {
    setColors(prev => ({
      ...prev,
      [key]: value,
    }));
  };

  // 重置单个颜色为默认值
  const resetThemeColor = (key: string) => {
    const defaultValue = allDefaults[key];
    if (defaultValue) {
      setColors(prev => ({
        ...prev,
        [key]: defaultValue,
      }));
    }
  };

  // 重置所有主题色
  const resetAllThemeColors = () => {
    setModeState('dark');
    setColors(allDefaults);
  };

  return (
    <ThemeContext.Provider value={{
      theme,
      mode,
      setMode,
      colors,
      updateThemeColor,
      resetThemeColor,
      resetAllThemeColors,
    }}>
      {children}
    </ThemeContext.Provider>
  );
};

// 使用主题的 Hook
export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
