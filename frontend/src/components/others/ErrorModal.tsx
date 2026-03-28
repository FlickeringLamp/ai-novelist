import UnifiedModal from './UnifiedModal.tsx';
import type { ErrorModalProps } from '@/types';

const ErrorModal = ({ errorMessage, onClose }: ErrorModalProps) => {
  if (!errorMessage) return null;

  return (
    <UnifiedModal
      message={errorMessage}
      buttons={[
        {
          text: '确定',
          onClick: () => {
            onClose();
          },
          className: 'bg-theme-green'
        }
      ]}
    />
  );
};

export default ErrorModal;
