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
  // 终端功能
  terminal: {
    create: (terminalId, shell, cwd) => ipcRenderer.invoke('terminal:create', { terminalId, shell, cwd }),
    write: (terminalId, data) => ipcRenderer.invoke('terminal:write', { terminalId, data }),
    resize: (terminalId, cols, rows) => ipcRenderer.invoke('terminal:resize', { terminalId, cols, rows }),
    kill: (terminalId) => ipcRenderer.invoke('terminal:kill', { terminalId }),
    killAll: () => ipcRenderer.invoke('terminal:kill-all'),
    onData: (terminalId, callback) => {
      const channel = `terminal:data:${terminalId}`;
      ipcRenderer.on(channel, (event, data) => callback(data));
      return () => ipcRenderer.removeAllListeners(channel);
    },
    onExit: (terminalId, callback) => {
      const channel = `terminal:exit:${terminalId}`;
      ipcRenderer.on(channel, (event, data) => callback(data));
      return () => ipcRenderer.removeAllListeners(channel);
    },
  },
});
