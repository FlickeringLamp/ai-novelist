const { app, BrowserWindow, ipcMain, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const http = require('http');


let mainWindow;
let backendProcess = null;
let backendPid = null;

// 开发环境配置，app.isPackaged，Electron 提供，判断应用是否打包的 API
const isDev = !app.isPackaged;


// 获取后端可执行文件路径
function getBackendPath() {
  if (isDev) {
    // 开发环境：使用 Python 直接运行
    return {
      type: 'python',
      path: path.join(__dirname, '..', 'main.py')
    };
  } else {
    // 生产环境：使用打包后的 exe
    return {
      type: 'exe',
      path: path.join(process.resourcesPath, 'backend', 'ai-novelist.exe')
    };
  }
}

// 启动后端服务
function startBackend() {
  const backend = getBackendPath();
  const { spawn } = require('child_process');
  
  if (backend.type === 'python') {
    // 开发环境：使用 Python 运行
    // 跨平台启动 Python
    const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
    backendProcess = spawn(pythonCmd, [backend.path], {
      cwd: path.dirname(backend.path),
      detached: false,
      stdio: 'inherit'
    });
    
    // 直接获取 PID
    if (backendProcess.pid) {
      backendPid = backendProcess.pid;
    }
  } else {
    // 生产环境：运行 exe
    if (!fs.existsSync(backend.path)) {
      console.error('后端可执行文件不存在:', backend.path);
      return;
    }
    
    backendProcess = spawn(backend.path, [], {
      cwd: path.dirname(backend.path),
      detached: false,
      stdio: 'inherit'
    });
    
    // 直接获取 PID
    if (backendProcess.pid) {
      backendPid = backendProcess.pid;
    }
  }

  backendProcess.on('close', (code) => {
    console.log(`后端进程退出，代码: ${code}`);
    backendProcess = null;
  });

  console.log('后端服务已启动，PID:', backendPid);
}

// 停止后端服务
function stopBackend(callback) {
  const { exec, execSync } = require('child_process');
  
  // 跨平台获取端口占用进程PID
  const getPidByPort = (port) => {
    try {
      let output;
      if (process.platform === 'win32') {
        // Windows: netstat -ano | findstr :8000
        output = execSync(`netstat -ano | findstr :${port}`).toString();
        const lines = output.trim().split('\n');
        const pids = new Set();
        for (const line of lines) {
          const parts = line.trim().split(/\s+/);
          if (parts.length >= 5) {
            pids.add(parts[parts.length - 1]);
          }
        }
        return Array.from(pids);
      } else {
        // Linux/Mac: lsof -ti:8000 或 ss -tlnp
        try {
          output = execSync(`lsof -ti:${port}`).toString();
          return output.trim().split('\n').filter(pid => pid);
        } catch (e) {
          // lsof 可能不存在，尝试使用 fuser
          try {
            output = execSync(`fuser ${port}/tcp 2>/dev/null`).toString();
            return output.trim().split(/\s+/).filter(pid => pid);
          } catch (e2) {
            return [];
          }
        }
      }
    } catch (e) {
      return [];
    }
  };
  
  // 跨平台杀死进程
  const killProcess = (pid, signal = 'SIGTERM') => {
    return new Promise((resolve) => {
      if (process.platform === 'win32') {
        exec(`taskkill /F /PID ${pid}`, (error) => {
          resolve(!error);
        });
      } else {
        try {
          process.kill(parseInt(pid), signal);
          resolve(true);
        } catch (e) {
          resolve(false);
        }
      }
    });
  };
  
  const checkAndKill = async () => {
    const pids = getPidByPort(8000);
    if (pids.length > 0) {
      // 关闭所有占用端口的进程
      for (const pid of pids) {
        await killProcess(pid, 'SIGTERM');
      }
      // 继续检查
      setTimeout(checkAndKill, 500);
    } else {
      // 没有进程了，执行回调
      console.log('8000端口已释放');
      if (callback) callback();
    }
  };
  
  // 先关闭已知的backendPid
  if (backendPid) {
    killProcess(backendPid, 'SIGTERM').then(() => {
      console.log('后端服务已停止');
      backendPid = null;
      backendProcess = null;
      // 检查端口是否还有进程
      checkAndKill();
    });
  } else {
    // 直接检查端口
    checkAndKill();
  }
}

// 创建主窗口
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    frame: false,
    titleBarStyle: 'hidden',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.cjs')
    },
    icon: path.join(__dirname, 'assets', 'icon.png')
  });

  // 完全移除菜单栏
  Menu.setApplicationMenu(null);

  mainWindow.maximize();

  // 开发环境加载开发服务器，生产环境加载打包后的文件
  if (isDev) {
    mainWindow.loadURL('http://localhost:3000');
    // 开发环境自动打开开发者工具
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, 'index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// 应用启动
app.whenReady().then(() => {
  // 先启动后端
  startBackend();
  
  // 用递归来轮询健康检查，直到后端启动成功
  const checkBackendReady = () => {
    const http = require('http');
    const options = {
      hostname: 'localhost',
      port: 8000,
      path: '/api/config/health',
      method: 'GET',
      timeout: 1000
    };
    
    const req = http.request(options, (res) => {
      if (res.statusCode === 200) {
        createWindow();
      } else {
        setTimeout(checkBackendReady, 500);
      }
    });
    
    req.on('error', () => {
      setTimeout(checkBackendReady, 500);
    });
    
    req.end();
  };
  
  // 延迟1秒后开始检查
  setTimeout(checkBackendReady, 1000);
});

// 应用退出时清理.冗余一次空检查，确保各种退出路径都能清理后端。
app.on('window-all-closed', () => {
  stopBackend();
  app.quit();
});
app.on('before-quit', () => {
  stopBackend();
});

// IPC 通信：重启后端
ipcMain.handle('restart-backend', () => {
  stopBackend();
  startBackend();
  return { success: true };
});

// IPC 通信：窗口控制
ipcMain.handle('window-minimize', () => {
  if (mainWindow) {
    mainWindow.minimize();
  }
});

ipcMain.handle('window-maximize', () => {
  if (mainWindow) {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  }
});

ipcMain.handle('window-close', () => {
  if (mainWindow) {
    mainWindow.close();
  }
});

// ============ 终端功能 ============
const pty = require('node-pty');

// 存储终端实例
const terminals = new Map();

// 获取默认 shell
function getDefaultShell() {
  if (process.platform === 'win32') {
    return 'powershell.exe';
  }
  return process.env.SHELL || '/bin/bash';
}

// 创建终端
ipcMain.handle('terminal:create', (event, { terminalId, shell, cwd }) => {
  try {
    const shellPath = shell || getDefaultShell();
    const cwdPath = cwd || process.env.HOME || process.cwd();

    const ptyProcess = pty.spawn(shellPath, [], {
      name: 'xterm-color',
      cwd: cwdPath,
      env: process.env,
      useConpty: process.platform === 'win32',
    });

    // 转发 PTY 输出到前端
    ptyProcess.onData((data) => {
      event.sender.send(`terminal:data:${terminalId}`, data);
    });

    ptyProcess.onExit(({ exitCode, signal }) => {
      event.sender.send(`terminal:exit:${terminalId}`, { exitCode, signal });
      terminals.delete(terminalId);
    });

    terminals.set(terminalId, ptyProcess);

    return { success: true, pid: ptyProcess.pid };
  } catch (error) {
    console.error('创建终端失败:', error);
    return { success: false, error: error.message };
  }
});

// 向终端写入数据
ipcMain.handle('terminal:write', (event, { terminalId, data }) => {
  const ptyProcess = terminals.get(terminalId);
  if (ptyProcess) {
    ptyProcess.write(data);
    return { success: true };
  }
  return { success: false, error: 'Terminal not found' };
});

// 调整终端大小
ipcMain.handle('terminal:resize', (event, { terminalId, cols, rows }) => {
  const ptyProcess = terminals.get(terminalId);
  if (ptyProcess) {
    ptyProcess.resize(cols, rows);
    return { success: true };
  }
  return { success: false, error: 'Terminal not found' };
});

// 关闭终端
ipcMain.handle('terminal:kill', (event, { terminalId }) => {
  const ptyProcess = terminals.get(terminalId);
  if (ptyProcess) {
    ptyProcess.kill();
    terminals.delete(terminalId);
    return { success: true };
  }
  return { success: false, error: 'Terminal not found' };
});

// 清理所有终端
ipcMain.handle('terminal:kill-all', () => {
  for (const [terminalId, ptyProcess] of terminals) {
    ptyProcess.kill();
  }
  terminals.clear();
  return { success: true };
});

// 应用退出时清理终端
app.on('before-quit', () => {
  for (const [terminalId, ptyProcess] of terminals) {
    ptyProcess.kill();
  }
  terminals.clear();
});

