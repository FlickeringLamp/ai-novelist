// frontend/src/components/others/BackendStatusIndicator.tsx
import { useEffect, useState } from 'react';
import { healthChecker } from '../../utils/healthCheck';

interface HealthStatus {
  isOnline: boolean;
  lastCheckTime: Date | null;
  consecutiveFailures: number;
}

export default function BackendStatusIndicator() {
  const [status, setStatus] = useState<HealthStatus>(healthChecker.getStatus());

  useEffect(() => {
    // 启动健康检查
    healthChecker.start();

    // 监听状态变化
    const handleStatusChange = (newStatus: HealthStatus) => {
      setStatus(newStatus);
    };

    healthChecker.addListener(handleStatusChange);

    // 组件卸载时停止检查
    return () => {
      healthChecker.removeListener(handleStatusChange);
      healthChecker.stop();
    };
  }, []);

  return (
    <div className={`fixed top-4 right-4 z-50 px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 ${
      status.isOnline 
        ? 'bg-green-500/20 text-green-400 border border-green-500/50' 
        : 'bg-red-500/20 text-red-400 border border-red-500/50'
      }`}>
      <div className={`w-2 h-2 rounded-full ${
        status.isOnline ? 'bg-green-400 animate-pulse' : 'bg-red-400'
      }`} />
      <span className="text-sm font-medium">
        {status.isOnline ? '后端在线' : '后端断开连接'}
      </span>
      {!status.isOnline && (
        <span className="text-xs text-red-300">
          请确保后端服务正在运行
        </span>
      )}
    </div>
  );
}
