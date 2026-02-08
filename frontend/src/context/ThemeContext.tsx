import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';

// 默认主题配置
const defaultTheme = {
  black: '#000000',    // 纯黑：项目底色
  green: '#34eb5c',    // 绿色：普通状态，用于小件
  green1: '#2ad541',  // 暗绿色：用于用户消息气泡
  white: '#FFFFFF',    // 纯白色：普通状态，多用于字体
  red:   '#ff0000',      // 红色：错误/离线状态，用于小件
  gray1: '#111111',    // 焦浓重淡清
  gray2: '#333333',    // hover、activate 状态
  gray3: '#666666',
  gray4: '#999999',
  gray5: '#cccccc',
};

// 创建主题上下文
interface ThemeContextType {
  theme: typeof defaultTheme;
  updateTheme: (newTheme: Partial<typeof defaultTheme>) => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: defaultTheme,
  updateTheme: () => {},
});

// 主题提供者组件
export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const [theme, setTheme] = useState(defaultTheme);

  // 应用主题到 CSS 变量
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--color-black', theme.black);
    root.style.setProperty('--color-green', theme.green);
    root.style.setProperty('--color-green1', theme.green1);
    root.style.setProperty('--color-white', theme.white);
    root.style.setProperty('--color-red', theme.red);
    root.style.setProperty('--color-gray1', theme.gray1);
    root.style.setProperty('--color-gray2', theme.gray2);
    root.style.setProperty('--color-gray3', theme.gray3);
    root.style.setProperty('--color-gray4', theme.gray4);
    root.style.setProperty('--color-gray5', theme.gray5);
  }, [theme]);

  // 更新主题的函数（预留用于后续的动态主题功能）
  const updateTheme = (newTheme: Partial<typeof defaultTheme>) => {
    setTheme(prevTheme => ({
      ...prevTheme,
      ...newTheme,
    }));
  };

  return (
    <ThemeContext.Provider value={{ theme, updateTheme }}>
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
