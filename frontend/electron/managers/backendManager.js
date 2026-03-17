import { spawn, exec, execSync } from 'child_process';
import http from 'http';
import path from 'path';
import fs from 'fs';
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
    ipcMain.handle('backend:restart', () => {
      this.restart();
      return { success: true };
    });
  }

  // 启动后端服务
  start() {
    const backend = getBackendPath();
    
    if (backend.type === 'python') {
      const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
      this.process = spawn(pythonCmd, [backend.path], {
        cwd: path.dirname(backend.path),
        detached: false,
        stdio: 'inherit',
      });
    } else {
      if (!fs.existsSync(backend.path)) {
        console.error('后端可执行文件不存在:', backend.path);
        return;
      }
      
      this.process = spawn(backend.path, [], {
        cwd: path.dirname(backend.path),
        detached: false,
        stdio: 'inherit',
      });
    }

    if (this.process.pid) {
      this.pid = this.process.pid;
    }

    this.process.on('close', (code) => {
      console.log(`后端进程退出，代码: ${code}`);
      this.process = null;
    });

    console.log('后端服务已启动，PID:', this.pid);
  }

  // 停止后端服务
  stop(callback) {
    const { port } = APP_CONFIG.backend;
    
    const getPidByPort = (port) => {
      try {
        let output;
        if (process.platform === 'win32') {
          output = execSync(`netstat -ano | findstr :${port}`).toString();
          const lines = output.trim().split('\n');
          const pids = new Set();
          for (const line of lines) {
            const parts = line.trim().split(/\s+/);
            if (parts.length >= 5) {
              pids.add(parts[parts.length - 1]);
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
    };

    const killProcess = (pid, signal = 'SIGTERM') => {
      return new Promise((resolve) => {
        if (process.platform === 'win32') {
          exec(`taskkill /F /PID ${pid}`, (error) => {
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
    };

    const checkAndKill = async () => {
      const pids = getPidByPort(port);
      if (pids.length > 0) {
        for (const pid of pids) {
          await killProcess(pid, 'SIGTERM');
        }
        setTimeout(checkAndKill, 500);
      } else {
        console.log(`${port}端口已释放`);
        if (callback) callback();
      }
    };

    if (this.pid) {
      killProcess(this.pid, 'SIGTERM').then(() => {
        console.log('后端服务已停止');
        this.pid = null;
        this.process = null;
        checkAndKill();
      });
    } else {
      checkAndKill();
    }
  }

  // 重启后端服务
  restart() {
    this.stop(() => {
      this.start();
    });
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
