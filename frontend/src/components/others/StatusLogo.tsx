import { useEffect, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFire } from '@fortawesome/free-solid-svg-icons';
import { getWSClient } from '../../utils/wsClient';
import type { StatusLogoProps, HealthStatus } from '@/types';
import './StatusLogo.css';

const StatusLogo = ({ isCollapsed, onToggleCollapse }: StatusLogoProps) => {
  const [status, setStatus] = useState<HealthStatus>({
    isOnline: false,
    lastCheckTime: null
  });

  useEffect(() => {
    const wsClient = getWSClient('ws://localhost:8000/ws');

    const handleConnect = () => {
      console.log('[StatusLogo] WebSocket 已连接');
      setStatus({ isOnline: true, lastCheckTime: new Date() });
    };

    const handleDisconnect = () => {
      console.log('[StatusLogo] WebSocket 已断开');
      setStatus({ isOnline: false, lastCheckTime: new Date() });
    };

    // 注册 WebSocket 监听，取消订阅函数收集起来，便于后续清理
    const unsubscribeConnect = wsClient.onConnect(handleConnect);
    const unsubscribeDisconnect = wsClient.onDisconnect(handleDisconnect);

    // 如果已经连接，立即更新状态
    if (wsClient.isConnected) {
      setStatus({ isOnline: true, lastCheckTime: new Date() });
    }

    return () => {
      unsubscribeConnect();
      unsubscribeDisconnect();
    };
  }, []);

  const getTooltip = () => {
    const statusText = status.isOnline ? '后端在线' : '后端断开连接';
    const actionText = isCollapsed ? '展开左侧面板' : '折叠左侧面板';
    return `${statusText} · ${actionText}`;
  };

  const getColorClass = () => {
    if (!status.isOnline) return 'text-theme-red';
    return 'text-theme-green';
  };

  return (
    <button
      onClick={onToggleCollapse}
      className="relative flex items-center justify-center p-2 hover:bg-theme-gray3 rounded transition-colors"
      title={getTooltip()}
    >
      <FontAwesomeIcon
        icon={faFire}
        className={`${getColorClass()} breathing-animation text-sm`}
      />
    </button>
  );
};

export default StatusLogo;
