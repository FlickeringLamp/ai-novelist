import { app } from 'electron';
import { backendManager } from './managers/backendManager.js';
import { windowManager } from './managers/windowManager.js';
import { terminalManager } from './managers/terminalManager.js';
import { APP_CONFIG } from './utils/constants.js';

// 应用启动
app.whenReady().then(async () => {

  // 启动后端服务
  backendManager.start();

  // 等待后端就绪后创建窗口
  await new Promise(resolve => setTimeout(resolve, APP_CONFIG.backend.startupDelay));
  
  const checkAndCreateWindow = async () => {
    const isReady = await backendManager.checkHealth();
    if (isReady) {
      windowManager.createWindow();
    } else {
      setTimeout(checkAndCreateWindow, APP_CONFIG.backend.checkInterval);
    }
  };
  
  checkAndCreateWindow();
});

// 应用退出时清理
app.on('window-all-closed', async () => {
  await backendManager.stop();
  terminalManager.killAllTerminals();
  app.quit();
});

app.on('before-quit', async () => {
  await backendManager.stop();
  terminalManager.killAllTerminals();
});
