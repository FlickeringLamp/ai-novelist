import UnifiedModal from '../../others/UnifiedModal';

interface NotificationModalProps {
  message: string;
  onClose: () => void;
}

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
