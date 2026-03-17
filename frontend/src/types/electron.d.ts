interface ElectronAPI {
  // 通用调用方法：channel 是 IPC 名称，如 'window:minimize', 'backend:restart'
  invoke: (channel: string, ...args: any[]) => Promise<any>;
  
  // 终端专用（需要双向通信）
  terminal: {
    invoke: (channel: string, ...args: any[]) => Promise<any>;
    on: (channel: string, callback: (data: any) => void) => () => void;
  };
}

declare global {
  interface Window {
    electron: ElectronAPI;
  }
}

export {};
