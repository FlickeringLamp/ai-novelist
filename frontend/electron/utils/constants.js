import path from 'path';
import { fileURLToPath } from 'url';
import { app } from 'electron';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 应用配置
export const APP_CONFIG = {
  // 窗口配置
  window: {
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
  },
  // 后端服务配置
  backend: {
    port: 8000,
    healthCheckPath: '/api/config/health',
    healthCheckTimeout: 1000,
    startupDelay: 1000,
    checkInterval: 500,
  },
  // 路径配置
  paths: {
    icon: path.join(__dirname, '../../assets', 'icon.png'),
    preload: path.join(__dirname, '../preload.mjs'),
    indexHtml: path.join(__dirname, '../../index.html'),
  },
};

// 开发环境检测
// 使用 Electron 提供的 app.isPackaged
// - 开发环境：isPackaged = false
// - 打包后的应用：isPackaged = true
export const isDev = !app.isPackaged;

// 获取后端路径
export function getBackendPath() {
  if (isDev) {
    return {
      type: 'python',
      path: path.join(__dirname, '../../..', 'main.py'),
    };
  } else {
    return {
      type: 'exe',
      path: path.join(process.resourcesPath, 'backend', 'ai-novelist.exe'),
    };
  }
}

// 获取默认 shell
export function getDefaultShell() {
  if (process.platform === 'win32') {
    return 'powershell.exe';
  }
  return process.env.SHELL || '/bin/bash';
}
