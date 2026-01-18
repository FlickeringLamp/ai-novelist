/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // 四种基础颜色 - 使用 CSS 变量以支持动态主题
        // 纯黑：项目底色，大部分面板组件
        'theme-black': 'var(--color-black)',
        // 绿色：特色色，用于按钮、字体、图标等小件
        'theme-green': 'var(--color-green)',
        // 灰色：用于 hover、activate 等状态
        'theme-gray': 'var(--color-gray)',
        // 纯白色：用于字体
        'theme-white': 'var(--color-white)',
      },
      borderRadius: {
        'small': '4px',
        'medium': '8px',
      },
      boxShadow: {
        'light': '0 1px 3px rgba(0, 0, 0, 0.3)',
        'medium': '0 4px 6px rgba(0, 0, 0, 0.4)',
        'deep': '0 8px 12px rgba(0, 0, 0, 0.5)',
      },
    },
  },
  plugins: [],
}
