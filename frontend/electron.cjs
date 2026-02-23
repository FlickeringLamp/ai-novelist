const { app, BrowserWindow, ipcMain, Menu } = require('electron');
const path = require('path');
const fs = require('fs');


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
  
  if (backend.type === 'python') {
    // 开发环境：使用 Python 运行
    const { exec } = require('child_process');
    backendProcess = exec(`start cmd /k "python ${backend.path}"`, {
      cwd: path.dirname(backend.path)
    });
    // 获取 Python 进程的 PID（需要稍后通过进程名查找）
    setTimeout(() => {
      const { execSync } = require('child_process');
      try {
        const output = execSync('tasklist /FI "IMAGENAME eq python.exe" /FO CSV /NH').toString();
        const lines = output.trim().split('\n');
        if (lines.length > 0) {
          const pid = lines[0].split(',')[1].replace(/"/g, '');
          backendPid = parseInt(pid);
        }
      } catch (e) {
        console.error('获取后端进程 PID 失败:', e);
      }
    }, 1000);
  } else {
    // 生产环境：运行 exe
    if (!fs.existsSync(backend.path)) {
      console.error('后端可执行文件不存在:', backend.path);
      return;
    }
    const { exec } = require('child_process');
    backendProcess = exec(`start "" "${backend.path}"`, {
      cwd: path.dirname(backend.path)
    });
    // 获取后端进程的 PID（需要稍后通过进程名查找）
    setTimeout(() => {
      const { execSync } = require('child_process');
      try {
        const exeName = path.basename(backend.path);
        const output = execSync(`tasklist /FI "IMAGENAME eq ${exeName}" /FO CSV /NH`).toString();
        const lines = output.trim().split('\n');
        if (lines.length > 0) {
          const pid = lines[0].split(',')[1].replace(/"/g, '');
          backendPid = parseInt(pid);
        }
      } catch (e) {
        console.error('获取后端进程 PID 失败:', e);
      }
    }, 1000);
  }

  backendProcess.on('close', (code) => {
    console.log(`后端进程退出，代码: ${code}`);
    backendProcess = null;
  });

  console.log('后端服务已启动');
}

// 停止后端服务
function stopBackend() {
  if (backendPid) {
    const { exec } = require('child_process');
    exec(`taskkill /F /PID ${backendPid}`, (error) => {
      if (error) {
        console.error('停止后端服务失败:', error);
      } else {
        console.log('后端服务已停止');
      }
    });
    backendPid = null;
    backendProcess = null;
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
  
  // 等待一下让后端启动完成
  setTimeout(() => {
    createWindow();
  }, 2000);

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
