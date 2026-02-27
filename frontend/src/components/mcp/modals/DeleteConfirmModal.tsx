import UnifiedModal from '../../others/UnifiedModal';

interface DeleteConfirmModalProps {
  isOpen: boolean;
  serverId: string;
  serverName: string;
  onClose: () => void;
  onConfirm: (serverId: string) => Promise<void>;
}

const DeleteConfirmModal = ({
  isOpen,
  serverId,
  serverName,
  onClose,
  onConfirm
}: DeleteConfirmModalProps) => {
  if (!isOpen) return null;

  return (
    <UnifiedModal
      message={`确定要删除MCP服务器 "${serverName}" 吗？此操作不可撤销。`}
      buttons={[
        { text: '确定', onClick: () => onConfirm(serverId), className: 'bg-theme-green' },
        { text: '取消', onClick: onClose, className: 'bg-theme-gray3' }
      ]}
    />
  );
};

export default DeleteConfirmModal;
