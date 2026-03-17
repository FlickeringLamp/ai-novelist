import { BrowserWindow, Menu, ipcMain } from 'electron';
import { APP_CONFIG, isDev } from '../utils/constants.js';

class WindowManager {
  constructor() {
    this.mainWindow = null;
    this.setupIpcHandlers();
  }

  // 自注册 IPC 处理器
  setupIpcHandlers() {
    ipcMain.handle('window:minimize', () => this.minimize());
    ipcMain.handle('window:maximize', () => this.maximize());
    ipcMain.handle('window:close', () => this.close());
  }

  // 创建主窗口
  createWindow() {
    this.mainWindow = new BrowserWindow({
      width: APP_CONFIG.window.width,
      height: APP_CONFIG.window.height,
      minWidth: APP_CONFIG.window.minWidth,
      minHeight: APP_CONFIG.window.minHeight,
      frame: false,
      titleBarStyle: 'hidden',
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: false,
        preload: APP_CONFIG.paths.preload,
      },
      icon: APP_CONFIG.paths.icon,
    });

    // 移除菜单栏
    Menu.setApplicationMenu(null);

    // 最大化窗口
    this.mainWindow.maximize();

    // 加载页面
    if (isDev) {
      this.mainWindow.loadURL('http://localhost:3000');
      this.mainWindow.webContents.openDevTools();
    } else {
      this.mainWindow.loadFile(APP_CONFIG.paths.indexHtml);
    }

    this.mainWindow.on('closed', () => {
      // 清理所有终端进程
      import('./terminalManager.js').then(({ terminalManager }) => {
        terminalManager.killAllTerminals();
      });
      this.mainWindow = null;
    });

    return this.mainWindow;
  }

  // 获取主窗口
  getWindow() {
    return this.mainWindow;
  }

  // 最小化窗口
  minimize() {
    if (this.mainWindow) {
      this.mainWindow.minimize();
    }
  }

  // 最大化/还原窗口
  maximize() {
    if (this.mainWindow) {
      if (this.mainWindow.isMaximized()) {
        this.mainWindow.unmaximize();
      } else {
        this.mainWindow.maximize();
      }
    }
  }

  // 关闭窗口
  close() {
    if (this.mainWindow) {
      this.mainWindow.close();
    }
  }
}

export const windowManager = new WindowManager();
