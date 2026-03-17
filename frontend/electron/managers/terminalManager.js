import { ipcMain } from 'electron';
import { spawn } from 'node-pty';
import { getDefaultShell } from '../utils/constants.js';

class TerminalManager {
  constructor() {
    this.terminals = new Map();
    this.setupIpcHandlers();
  }

  // 自注册 IPC 处理器
  setupIpcHandlers() {
    // 创建终端
    ipcMain.handle('terminal:create', (event, { terminalId }) => {
      try {
        const shellPath = getDefaultShell();
        const cwdPath = process.env.HOME || process.cwd();

        const ptyProcess = spawn(shellPath, [], {
          name: 'xterm-color',
          cwd: cwdPath,
          env: process.env,
          useConpty: process.platform === 'win32',
        });

        // 终端被 kill() 时，会触发 onExit 事件，其中的 event.sender.send() 仍会尝试向已销毁的窗口发送消息。所以需要先检查是否销毁，再发消息
        // 转发 PTY 输出到前端
        ptyProcess.onData((data) => {
          if (!event.sender.isDestroyed()) {
            event.sender.send(`terminal:data:${terminalId}`, data);
          }
        });

        ptyProcess.onExit(({ exitCode, signal }) => {
          console.log(`[Terminal] ${terminalId} exited with code ${exitCode}, signal ${signal}`);
          if (!event.sender.isDestroyed()) {
            event.sender.send(`terminal:exit:${terminalId}`, { exitCode, signal });
          }
          this.terminals.delete(terminalId);
        });

        this.terminals.set(terminalId, ptyProcess);

        return { success: true, pid: ptyProcess.pid };
      } catch (error) {
        console.error('创建终端失败:', error);
        return { success: false, error: error.message };
      }
    });

    // 向终端写入数据
    ipcMain.handle('terminal:write', (event, { terminalId, data }) => {
      const ptyProcess = this.terminals.get(terminalId);
      if (ptyProcess) {
        ptyProcess.write(data);
        return { success: true };
      }
      return { success: false, error: 'Terminal not found' };
    });

    // 调整终端大小
    ipcMain.handle('terminal:resize', (event, { terminalId, cols, rows }) => {
      const ptyProcess = this.terminals.get(terminalId);
      if (ptyProcess) {
        ptyProcess.resize(cols, rows);
        return { success: true };
      }
      return { success: false, error: 'Terminal not found' };
    });

    // 关闭单个终端
    ipcMain.handle('terminal:kill', (event, { terminalId }) => {
      return this.killTerminal(terminalId);
    });
  }

  // 关闭指定终端
  killTerminal(terminalId) {
    const ptyProcess = this.terminals.get(terminalId);
    if (ptyProcess) {
      ptyProcess.kill();
      this.terminals.delete(terminalId);
      return { success: true };
    }
    return { success: false, error: 'Terminal not found' };
  }

  // 关闭所有终端
  killAllTerminals() {
    for (const [terminalId, ptyProcess] of this.terminals) {
      ptyProcess.kill();
    }
    this.terminals.clear();
  }

  // 获取终端数量
  getTerminalCount() {
    return this.terminals.size;
  }
}

export const terminalManager = new TerminalManager();
