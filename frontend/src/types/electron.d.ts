interface ElectronAPI {
  restartBackend: () => Promise<{ success: boolean }>;
  windowMinimize: () => Promise<void>;
  windowMaximize: () => Promise<void>;
  windowClose: () => Promise<void>;
  mcpInstall: (serverId: string, packageName: string) => Promise<{ success: boolean; message: string; installPath?: string }>;
  mcpUninstall: (serverId: string) => Promise<{ success: boolean; message: string }>;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

export {};
