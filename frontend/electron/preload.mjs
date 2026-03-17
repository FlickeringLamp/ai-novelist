import { contextBridge, ipcRenderer } from 'electron';

// 暴露通用调用方法
contextBridge.exposeInMainWorld('electron', {
  // 通用 invoke：channel 就是 IPC 名称，args 是参数
  invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args),
  
  // 终端需要双向通信（接收服务器推送），单独处理
  terminal: {
    invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args),
    on: (channel, callback) => {
      ipcRenderer.on(channel, (event, data) => callback(data));
      return () => ipcRenderer.removeAllListeners(channel);
    }
  }
});
