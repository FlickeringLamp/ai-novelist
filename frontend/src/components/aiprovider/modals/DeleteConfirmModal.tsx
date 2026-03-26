import type { DeleteConfirmModalProps } from '../../../types';
import UnifiedModal from '../../others/UnifiedModal';

const DeleteConfirmModal = ({
  isOpen,
  providerId,
  providerName,
  onClose,
  onConfirm
}: DeleteConfirmModalProps) => {
  if (!isOpen) return null;

  return (
    <UnifiedModal
      message={`确定要删除提供商 "${providerName}" 吗？此操作不可撤销。`}
      buttons={[
        { text: '确定', onClick: () => onConfirm(providerId), className: 'bg-theme-green' },
        { text: '取消', onClick: onClose, className: 'bg-theme-gray3' }
      ]}
    />
  );
};

export default DeleteConfirmModal;
