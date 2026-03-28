import type { NotificationModalProps } from '@/types';
import UnifiedModal from '../../others/UnifiedModal';

const NotificationModal = ({ message, onClose }: NotificationModalProps) => {
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
