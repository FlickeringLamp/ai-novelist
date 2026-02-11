import UnifiedModal from '../../others/UnifiedModal';

interface DeleteBaseConfirmModalProps {
  isOpen: boolean;
  knowledgeBaseId: string;
  knowledgeBaseName: string;
  onClose: () => void;
  onConfirm: (knowledgeBaseId: string) => Promise<void>;
}

const DeleteBaseConfirmModal = ({
  isOpen,
  knowledgeBaseId,
  knowledgeBaseName,
  onClose,
  onConfirm
}: DeleteBaseConfirmModalProps) => {
  if (!isOpen) return null;

  return (
    <UnifiedModal
      message={`确定要删除知识库 "${knowledgeBaseName}" 吗？此操作不可撤销。`}
      buttons={[
        { text: '确定', onClick: () => onConfirm(knowledgeBaseId), className: 'bg-theme-green' },
        { text: '取消', onClick: onClose, className: 'bg-theme-gray3' }
      ]}
    />
  );
};

export default DeleteBaseConfirmModal;
