import { useState, useEffect } from 'react';
import UnifiedModal from '../../others/UnifiedModal';

interface RenameProviderModalProps {
  isOpen: boolean;
  providerId: string;
  currentName: string;
  onClose: () => void;
  onSubmit: (providerId: string, newName: string) => Promise<void>;
}

const RenameProviderModal = ({
  isOpen,
  providerId,
  currentName,
  onClose,
  onSubmit
}: RenameProviderModalProps) => {
  const [newProviderName, setNewProviderName] = useState('');

  useEffect(() => {
    if (isOpen) {
      setNewProviderName(currentName);
    }
  }, [isOpen, currentName]);

  const handleSubmit = async () => {
    await onSubmit(providerId, newProviderName);
    setNewProviderName('');
  };

  const handleCancel = () => {
    setNewProviderName('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <UnifiedModal
      title="重命名提供商"
      inputs={[
        {
          label: '新名称:',
          type: 'text',
          value: newProviderName,
          onChange: setNewProviderName,
          placeholder: '请输入新名称',
          required: true
        }
      ]}
      buttons={[
        {
          text: '确定',
          onClick: handleSubmit,
          className: 'bg-theme-green'
        },
        {
          text: '取消',
          onClick: handleCancel,
          className: 'bg-theme-gray3'
        }
      ]}
    />
  );
};

export default RenameProviderModal;
