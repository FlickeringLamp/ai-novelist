// frontend/src/utils/healthCheck.ts

interface HealthStatus {
  isOnline: boolean;
  lastCheckTime: Date | null;
  consecutiveFailures: number;
}

class HealthChecker {
  private checkInterval: number = 3000; // 3秒检测一次
  private maxFailures: number = 1; // 连续失败1次就提示
  private intervalId: number | null = null;
  private status: HealthStatus = {
    isOnline: true,
    lastCheckTime: null,
    consecutiveFailures: 0
  };
  private listeners: Set<(status: HealthStatus) => void> = new Set();

  // 添加状态监听器
  addListener(listener: (status: HealthStatus) => void) {
    this.listeners.add(listener);
  }

  // 移除状态监听器
  removeListener(listener: (status: HealthStatus) => void) {
    this.listeners.delete(listener);
  }

  // 通知所有监听器
  private notifyListeners() {
    this.listeners.forEach(listener => listener({ ...this.status }));
  }

  // 执行健康检查
  private async checkHealth(): Promise<boolean> {
    try {
      const response = await fetch('http://localhost:8000/api/config/health', {
        method: 'GET',
        signal: AbortSignal.timeout(1000), // 1秒超时
      });
      return response.ok;
    } catch (error) {
      return false;
    }
  }

  // 执行单次检查
  private async performCheck() {
    const isHealthy = await this.checkHealth();
    this.status.lastCheckTime = new Date();

    if (isHealthy) {
      this.status.isOnline = true;
      this.status.consecutiveFailures = 0;
    } else {
      this.status.consecutiveFailures++;
      if (this.status.consecutiveFailures >= this.maxFailures) {
        this.status.isOnline = false;
      }
    }

    this.notifyListeners();
  }

  // 启动健康检查
  start() {
    if (this.intervalId) return; // 已经在运行

    // 立即执行一次检查
    this.performCheck();

    // 定时检查
    this.intervalId = setInterval(() => {
      this.performCheck();
    }, this.checkInterval);
  }

  // 停止健康检查
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  // 获取当前状态
  getStatus(): HealthStatus {
    return { ...this.status };
  }
}

// 导出单例
export const healthChecker = new HealthChecker();
