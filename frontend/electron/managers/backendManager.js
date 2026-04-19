import { spawn, exec, execSync } from 'child_process';
import http from 'http';
import path from 'path';
import { ipcMain } from 'electron';
import { getBackendPath, APP_CONFIG } from '../utils/constants.js';

class BackendManager {
  constructor() {
    this.process = null;
    this.pid = null;
    this.setupIpcHandlers();
  }

  // 自注册 IPC 处理器
  setupIpcHandlers() {
    ipcMain.handle('backend:restart', async () => {
      await this.restart();
      return { success: true };
    });
  }

  // 启动后端服务
  start() {
    const backend = getBackendPath();

    // 使用返回的 pythonPath 启动（开发环境是 'python'/'python3'，绿色包是具体路径）
    this.process = spawn(backend.pythonPath, [backend.path], {
      cwd: path.dirname(backend.path),
      detached: false,
      stdio: 'pipe',
      windowsHide: true,
    });

    if (this.process?.pid) {
      this.pid = this.process.pid;
    }

    // 转发 Python 输出到 Electron 控制台（让 launcher GUI 能捕获到）
    if (this.process.stdout) {
      this.process.stdout.on('data', (data) => {
        const lines = data.toString().trim().split('\n');
        for (const line of lines) {
          console.log(`[Python] ${line}`);
        }
      });
    }
    if (this.process.stderr) {
      this.process.stderr.on('data', (data) => {
        const lines = data.toString().trim().split('\n');
        for (const line of lines) {
          console.error(`[Python ERR] ${line}`);
        }
      });
    }

    this.process.on('close', (code) => {
      console.log(`后端进程退出，代码: ${code}`);
      this.process = null;
    });

    console.log('后端服务已启动，PID:', this.pid);
  }

  getPidByPort(port) {
    try {
      let output;
      if (process.platform === 'win32') {
        output = execSync(`netstat -ano | findstr :${port}`).toString();
        const lines = output.trim().split('\n');
        const pids = new Set();
        for (const line of lines) {
          const parts = line.trim().split(/\s+/);
          if (parts.length >= 5) {
            const state = parts[parts.length - 2];
            const pid = parts[parts.length - 1];
            // 只杀 LISTENING 状态的服务端进程；忽略 TIME_WAIT/CLOSE_WAIT 以及 PID 0
            if (state === 'LISTENING' && pid !== '0') {
              pids.add(pid);
            }
          }
        }
        return Array.from(pids);
      } else {
        try {
          output = execSync(`lsof -ti:${port}`).toString();
          return output.trim().split('\n').filter(pid => pid);
        } catch (e) {
          try {
            output = execSync(`fuser ${port}/tcp 2>/dev/null`).toString();
            return output.trim().split(/\s+/).filter(pid => pid);
          } catch (e2) {
            return [];
          }
        }
      }
    } catch (e) {
      return [];
    }
  }

  killProcess(pid, signal = 'SIGTERM') {
    return new Promise((resolve) => {
      if (process.platform === 'win32') {
        // /T 递归杀掉子进程树，避免孤儿进程残留
        exec(`taskkill /F /T /PID ${pid}`, (error) => {
          resolve(!error);
        });
      } else {
        try {
          process.kill(parseInt(pid), signal);
          resolve(true);
        } catch (e) {
          resolve(false);
        }
      }
    });
  }

  async waitForPortRelease(port, timeout = 5000) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      const pids = this.getPidByPort(port).filter(pid => pid !== '0');
      if (pids.length === 0) return true;
      for (const pid of pids) {
        await this.killProcess(pid, 'SIGTERM');
      }
      await new Promise(r => setTimeout(r, 300));
    }
    return this.getPidByPort(port).filter(pid => pid !== '0').length === 0;
  }

  // 停止后端服务
  async stop() {
    const { port } = APP_CONFIG.backend;

    if (this.pid) {
      await this.killProcess(this.pid, 'SIGTERM');
      console.log('后端主进程已发送终止信号');
      this.pid = null;
      this.process = null;
    }

    const released = await this.waitForPortRelease(port, 5000);
    if (released) {
      console.log(`${port}端口已释放`);
    } else {
      console.warn(`${port}端口在超时后仍被占用`);
    }
  }

  // 重启后端服务
  async restart() {
    await this.stop();
    this.start();
  }

  // 健康检查
  checkHealth() {
    const { port, healthCheckPath, healthCheckTimeout } = APP_CONFIG.backend;

    return new Promise((resolve) => {
      const options = {
        hostname: 'localhost',
        port,
        path: healthCheckPath,
        method: 'GET',
        timeout: healthCheckTimeout,
      };

      const req = http.request(options, (res) => {
        resolve(res.statusCode === 200);
      });

      req.on('error', () => {
        resolve(false);
      });

      req.on('timeout', () => {
        req.destroy();
        resolve(false);
      });

      req.end();
    });
  }

  // 等待后端就绪
  async waitForReady(callback) {
    const isReady = await this.checkHealth();
    if (isReady) {
      callback();
    } else {
      setTimeout(() => this.waitForReady(callback), APP_CONFIG.backend.checkInterval);
    }
  }
}

export const backendManager = new BackendManager();
