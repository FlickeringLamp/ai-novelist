import type { DeleteModeConfirmModalProps } from '@/types';
import UnifiedModal from '../../others/UnifiedModal';

const DeleteModeConfirmModal = ({ isOpen, modeId, modeName, onClose, onConfirm }: DeleteModeConfirmModalProps) => {
  if (!isOpen) return null;

  return (
    <UnifiedModal
      title="确认删除"
      message={`确定要删除模式 "${modeName}" 吗？此操作无法撤销。`}
      buttons={[
        { text: '确定', onClick: () => onConfirm(modeId), className: 'bg-theme-green' },
        { text: '取消', onClick: onClose, className: 'bg-theme-gray3' }
      ]}
    />
  );
};

export default DeleteModeConfirmModal;
