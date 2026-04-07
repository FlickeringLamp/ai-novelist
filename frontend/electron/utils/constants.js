import path from 'path';
import { fileURLToPath } from 'url';
import { app } from 'electron';
import fs from 'fs';

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

// 获取绿色包路径（electron.exe 所在目录）
function getGreenPackagePath() {
  return path.dirname(process.execPath);
}

// 检测是否为绿色包模式
function isGreenPackage() {
  const greenPath = getGreenPackagePath();
  const hasPython = fs.existsSync(path.join(greenPath, 'python', 'python.exe'));
  const hasMainPy = fs.existsSync(path.join(greenPath, 'main.py'));
  return hasPython && hasMainPy;
}

// 开发环境检测（同时排除绿色包模式）
export const isDev = !app.isPackaged && !isGreenPackage();

// 获取后端路径
export function getBackendPath() {
  if (isDev) {
    // 开发环境：使用系统 Python，找项目根目录的 main.py
    const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
    return {
      type: 'python',
      pythonPath: pythonCmd,
      path: path.join(__dirname, '../../..', 'main.py'),
    };
  }

  // 绿色包模式
  const greenPath = getGreenPackagePath();
  const pythonPath = path.join(greenPath, 'python', 'python.exe');
  const mainPyPath = path.join(greenPath, 'main.py');

  if (!fs.existsSync(pythonPath)) {
    throw new Error('无法找到便携 Python，请确保 python/python.exe 存在');
  }

  if (!fs.existsSync(mainPyPath)) {
    throw new Error('无法找到 main.py，请确保 main.py 在应用根目录');
  }

  return {
    type: 'portable',
    pythonPath: pythonPath,
    path: mainPyPath,
  };
}

// 获取便携 Python 路径（兼容旧代码）
export function getPortablePythonPath() {
  if (isDev) return null;
  return path.join(getGreenPackagePath(), 'python', 'python.exe');

  // 绿色包模式
  const greenPath = getGreenPackagePath();
  const portablePython = getPortablePythonPath();
  const mainPyPath = path.join(greenPath, 'main.py');

  if (!portablePython) {
    throw new Error('无法找到便携 Python，请确保 python/python.exe 存在');
  }

  if (!fs.existsSync(mainPyPath)) {
    throw new Error('无法找到 main.py，请确保 main.py 在应用根目录');
  }

  return {
    type: 'portable',
    pythonPath: portablePython,
    path: mainPyPath,
  };
}

// 获取默认 shell
export function getDefaultShell() {
  if (process.platform === 'win32') {
    return 'powershell.exe';
  }
  return process.env.SHELL || '/bin/bash';
}
