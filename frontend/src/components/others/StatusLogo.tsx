import { useEffect, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFire } from '@fortawesome/free-solid-svg-icons';
import { healthChecker } from '../../utils/healthCheck';
import './StatusLogo.css';

interface HealthStatus {
  isOnline: boolean;
  lastCheckTime: Date | null;
  consecutiveFailures: number;
}

interface StatusLogoProps {
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

const StatusLogo = ({ isCollapsed, onToggleCollapse }: StatusLogoProps) => {
  const [status, setStatus] = useState<HealthStatus>(healthChecker.getStatus());

  useEffect(() => {
    healthChecker.start();

    const handleStatusChange = (newStatus: HealthStatus) => {
      setStatus(newStatus);
    };

    healthChecker.addListener(handleStatusChange);

    return () => {
      healthChecker.removeListener(handleStatusChange);
      healthChecker.stop();
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
