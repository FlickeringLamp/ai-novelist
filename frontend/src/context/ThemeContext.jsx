import { createContext, useContext, useState, useEffect } from 'react';

// 默认主题配置
const defaultTheme = {
  black: '#000000',    // 纯黑：项目底色
  green: '#36ed51',    // 绿色：特色色
  gray: '#333333',     // 灰色：hover、activate 状态
  white: '#FFFFFF',    // 纯白色：字体
};

// 创建主题上下文
const ThemeContext = createContext({
  theme: defaultTheme,
  updateTheme: () => {},
});

// 主题提供者组件
export const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState(defaultTheme);

  // 应用主题到 CSS 变量
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--color-black', theme.black);
    root.style.setProperty('--color-green', theme.green);
    root.style.setProperty('--color-gray', theme.gray);
    root.style.setProperty('--color-white', theme.white);
  }, [theme]);

  // 更新主题的函数（预留用于后续的动态主题功能）
  const updateTheme = (newTheme) => {
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
