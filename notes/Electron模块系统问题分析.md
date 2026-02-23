# Electron 模块系统问题完整分析

## 一、核心问题概述

在引入 Electron 时遇到的根本问题是：**模块系统不一致**

### 问题表现
1. electron.js 使用 CommonJS 的 require，但 package.json 设置了 "type": "module"
2. preload.js 使用 CommonJS 的 require，但 package.json 设置了 "type": "module"
3. Electron 主进程对 ESM 支持有限
4. ESM 模块中缺少 __dirname 和 __filename

---

## 二、Node.js 模块系统基础知识

### 2.1 两种模块系统

#### CommonJS (CJS)
- **语法**: `require()` 导入，`module.exports` 导出
- **特点**: 同步加载，Node.js 原生支持
- **文件扩展名**: `.js` 或 `.cjs`
- **适用场景**: Node.js 后端代码

```javascript
// CommonJS 示例
const fs = require('fs');
const path = require('path');

module.exports = {
  myFunction: () => {}
};
```

#### ES Module (ESM)
- **语法**: `import` 导入，`export` 导出
- **特点**: 异步加载，现代 JavaScript 标准
- **文件扩展名**: `.mjs` 或在 "type": "module" 下的 `.js`
- **适用场景**: 前端代码、现代 Node.js 项目

```javascript
// ES Module 示例
import fs from 'fs';
import path from 'path';

export const myFunction = () => {};
```

### 2.2 文件扩展名的含义

| 扩展名 | 模块系统 | 说明 |
|--------|---------|------|
| `.js` | 取决于 package.json | 如果 package.json 有 "type": "module"，则为 ESM；否则为 CJS |
| `.mjs` | 强制 ESM | 无论 package.json 如何，都使用 ESM |
| `.cjs` | 强制 CJS | 无论 package.json 如何，都使用 CommonJS |

### 2.3 package.json 的 type 字段

```json
{
  "type": "module"  // 所有 .js 文件默认为 ESM
}
```

**影响**：
- 设置 `"type": "module"` 后，所有 `.js` 文件被视为 ESM
- 如果想使用 CommonJS，必须使用 `.cjs` 扩展名
- 如果想使用 ESM 但不设置 type，必须使用 `.mjs` 扩展名

---

## 三、Electron 架构与模块系统

### 3.1 Electron 的三个进程

```
┌─────────────────────────────────────────┐
│         Electron 应用                    │
├─────────────────────────────────────────┤
│  1. 主进程 (Main Process)                │
│     - electron.mjs                       │
│     - 管理应用生命周期                    │
│     - 创建窗口                           │
│     - 使用 Node.js API                   │
├─────────────────────────────────────────┤
│  2. 渲染进程 (Renderer Process)          │
│     - 你的 React/Vue 应用                │
│     - 运行在浏览器环境中                 │
│     - 不能直接访问 Node.js               │
├─────────────────────────────────────────┤
│  3. 预加载脚本 (Preload Script)          │
│     - preload.cjs                        │
│     - 桥接主进程和渲染进程               │
│     - 使用 contextBridge 安全暴露 API    │
└─────────────────────────────────────────┘
```

### 3.2 各进程的模块系统限制

| 进程 | 模块系统支持 | 推荐扩展名 | 原因 |
|------|------------|-----------|------|
| 主进程 | CJS / ESM (有限) | `.mjs` 或 `.cjs` | Electron 对 ESM 支持不完善，使用 `.mjs` 明确标识 |
| 预加载脚本 | CJS / ESM | `.cjs` | Electron 官方推荐使用 CJS，兼容性更好 |
| 渲染进程 | ESM | `.js` (在 "type": "module" 下) | 现代前端框架默认使用 ESM |

---

## 四、项目中的具体问题分析

### 4.1 问题一：electron.js 的模块系统冲突

**原始问题**：
```javascript
// electron.js (原始)
const { app, BrowserWindow } = require('electron');  // CommonJS
```

**package.json 配置**：
```json
{
  "type": "module"  // 所有 .js 文件被视为 ESM
}
```

**冲突原因**：
- `package.json` 设置了 `"type": "module"`
- `electron.js` 使用 `.js` 扩展名，Node.js 将其视为 ESM
- 但代码中使用的是 CommonJS 的 `require()`
- 导致语法错误

**解决方案**：
```javascript
// 方案1: 改为 ESM 语法，使用 .mjs 扩展名
// electron.mjs
import { app, BrowserWindow } from 'electron';
```

**为什么选择 .mjs**：
- 明确标识这是 ESM 模块
- 不依赖 package.json 的 type 设置
- Electron 对 .mjs 的支持更好

### 4.2 问题二：preload.js 的模块系统冲突

**原始问题**：
```javascript
// preload.js (原始)
const { contextBridge, ipcRenderer } = require('electron');  // CommonJS
```

**冲突原因**：
- 同样受到 `"type": "module"` 的影响
- Electron 的预加载脚本推荐使用 CommonJS
- ESM 在预加载脚本中可能有兼容性问题

**解决方案**：
```javascript
// preload.cjs
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getBackendStatus: () => ipcRenderer.invoke('get-backend-status'),
  restartBackend: () => ipcRenderer.invoke('restart-backend'),
  platform: process.platform,
  isPackaged: require('electron').app.isPackaged
});
```

**为什么选择 .cjs**：
- 明确标识这是 CommonJS 模块
- Electron 官方文档推荐预加载脚本使用 CJS
- 避免潜在的兼容性问题

### 4.3 问题三：ESM 中缺少 __dirname 和 __filename

**问题描述**：
```javascript
// CommonJS 中自动存在
console.log(__dirname);  // 当前文件所在目录
console.log(__filename); // 当前文件的完整路径
```

```javascript
// ESM 中不存在这些变量
import { app } from 'electron';
console.log(__dirname);  // ReferenceError: __dirname is not defined
```

**原因**：
- `__dirname` 和 `__filename` 是 CommonJS 的全局变量
- ESM 规范中没有定义这些变量
- 需要手动创建

**解决方案**：
```javascript
// electron.mjs
import path from 'path';
import { fileURLToPath } from 'url';

// 手动创建 __dirname 和 __filename
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 现在可以正常使用
console.log(__dirname);
console.log(__filename);
```

**原理解释**：
- `import.meta.url`: ESM 提供的元信息，包含当前模块的 URL（如 `file:///e:/ai-novelist/frontend/electron.mjs`）
- `fileURLToPath()`: 将 file:// URL 转换为文件系统路径
- `path.dirname()`: 获取文件所在目录

---

## 五、最终配置总结

### 5.1 文件结构

```
frontend/
├── package.json          # "type": "module"
├── electron.mjs          # 主进程 (ESM)
├── preload.cjs           # 预加载脚本 (CJS)
├── electron-builder.json # 打包配置
└── dist/                 # 构建输出
    └── index.html
```

### 5.2 package.json 关键配置

```json
{
  "type": "module",        // 前端代码使用 ESM
  "main": "electron.mjs",  // Electron 入口文件
  "scripts": {
    "electron-dev": "concurrently \"npm start\" \"wait-on http://localhost:3000 && electron .\"",
    "build-electron": "npm run build && electron-builder"
  }
}
```

### 5.3 electron.mjs 关键代码

```javascript
import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';

// ESM 兼容的 __dirname 定义
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function createWindow() {
  mainWindow = new BrowserWindow({
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs')  // 使用 .cjs
    }
  });
  
  // 加载构建后的 HTML
  mainWindow.loadFile(path.join(__dirname, 'dist', 'index.html'));
}
```

### 5.4 preload.cjs 关键代码

```javascript
const { contextBridge, ipcRenderer } = require('electron');

// 安全地暴露 API 到渲染进程
contextBridge.exposeInMainWorld('electronAPI', {
  getBackendStatus: () => ipcRenderer.invoke('get-backend-status'),
  restartBackend: () => ipcRenderer.invoke('restart-backend'),
  platform: process.platform,
  isPackaged: require('electron').app.isPackaged
});
```

---

## 六、关键知识点总结

### 6.1 模块系统选择原则

| 场景 | 推荐模块系统 | 扩展名 | 原因 |
|------|------------|--------|------|
| 前端 React/Vue | ESM | `.js` (配合 "type": "module") | 现代框架标准 |
| Electron 主进程 | ESM | `.mjs` | 明确标识，避免混淆 |
| Electron 预加载脚本 | CJS | `.cjs` | 官方推荐，兼容性好 |
| Node.js 工具脚本 | CJS | `.cjs` 或 `.js` (无 "type": "module") | 传统生态 |

### 6.2 文件扩展命名规则

1. **`.js`**: 默认扩展名，模块类型由 `package.json` 的 `type` 决定
2. **`.mjs`**: 强制 ESM，不受 `package.json` 影响
3. **`.cjs`**: 强制 CJS，不受 `package.json` 影响

### 6.3 Electron 特殊注意事项

1. **主进程**：
   - 可以使用 ESM，但建议用 `.mjs` 扩展名明确标识
   - 需要手动处理 `__dirname` 和 `__filename`

2. **预加载脚本**：
   - 推荐使用 CJS (`.cjs`)
   - 必须使用 `contextBridge` 安全暴露 API
   - 不能直接在渲染进程中使用 Node.js API

3. **渲染进程**：
   - 使用 ESM (`.js`)
   - 通过 `window.electronAPI` 访问预加载脚本暴露的 API