import UnifiedModal from '../../others/UnifiedModal';
import type { MCPNotificationModalProps } from '@/types';

const NotificationModal = ({ message, onClose }: MCPNotificationModalProps) => {
  return (
    <UnifiedModal
      message={message}
      buttons={[
        { text: '确定', onClick: onClose, className: 'bg-theme-green' }
      ]}
    />
  );
};

export default NotificationModal;
