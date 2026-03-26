import UnifiedModal from '../../others/UnifiedModal';
import type { MCPDeleteConfirmModalProps } from '@/types';

const DeleteConfirmModal = ({
  isOpen,
  serverId,
  serverName,
  onClose,
  onConfirm
}: MCPDeleteConfirmModalProps) => {
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
