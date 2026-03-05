const { contextBridge, ipcRenderer } = require('electron');

// 向渲染进程暴露安全的 API
contextBridge.exposeInMainWorld('electronAPI', {
  // 重启后端
  restartBackend: () => ipcRenderer.invoke('restart-backend'),
  // 窗口控制
  windowMinimize: () => ipcRenderer.invoke('window-minimize'),
  windowMaximize: () => ipcRenderer.invoke('window-maximize'),
  windowClose: () => ipcRenderer.invoke('window-close'),
  // MCP服务器管理
  mcpInstall: (serverId, packageName) => ipcRenderer.invoke('mcp-install', serverId, packageName),
});
