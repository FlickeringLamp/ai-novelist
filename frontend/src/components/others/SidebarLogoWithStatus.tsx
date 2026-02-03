import { useEffect, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFire } from '@fortawesome/free-solid-svg-icons';
import { healthChecker } from '../../utils/healthCheck';
import './SidebarLogoWithStatus.css';

interface HealthStatus {
  isOnline: boolean;
  lastCheckTime: Date | null;
  consecutiveFailures: number;
}

const SidebarLogoWithStatus = () => {
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

  return (
    <div
      className="relative flex items-center justify-center p-2"
      title={status.isOnline ? '后端在线' : '后端断开连接'}
    >
      <FontAwesomeIcon
        icon={faFire}
        className={`${status.isOnline ? 'text-theme-green' : 'text-theme-red'} breathing-animation`}
      />
    </div>
  );
};

export default SidebarLogoWithStatus;
