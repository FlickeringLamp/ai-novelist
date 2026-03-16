interface TerminalAPI {
  create: (terminalId: string, shell?: string, cwd?: string) => Promise<{ success: boolean; pid?: number; error?: string }>;
  write: (terminalId: string, data: string) => Promise<{ success: boolean; error?: string }>;
  resize: (terminalId: string, cols: number, rows: number) => Promise<{ success: boolean; error?: string }>;
  kill: (terminalId: string) => Promise<{ success: boolean; error?: string }>;
  killAll: () => Promise<{ success: boolean; error?: string }>;
  onData: (terminalId: string, callback: (data: string) => void) => () => void;
  onExit: (terminalId: string, callback: (data: { exitCode: number; signal?: number }) => void) => () => void;
}

interface ElectronAPI {
  restartBackend: () => Promise<{ success: boolean }>;
  windowMinimize: () => Promise<void>;
  windowMaximize: () => Promise<void>;
  windowClose: () => Promise<void>;
  mcpInstall: (serverId: string, packageName: string) => Promise<{ success: boolean; message: string; installPath?: string }>;
  mcpUninstall: (serverId: string) => Promise<{ success: boolean; message: string }>;
  terminal: TerminalAPI;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

export {};
