import { useState, useEffect } from 'react';
import type { RenameModeModalProps } from '@/types';
import UnifiedModal from '../../others/UnifiedModal';

const RenameModeModal = ({ isOpen, modeId, currentName, onClose, onSubmit }: RenameModeModalProps) => {
  const [newName, setNewName] = useState('');

  useEffect(() => {
    if (isOpen) {
      setNewName(currentName);
    }
  }, [isOpen, currentName]);

  const handleSubmit = async () => {
    await onSubmit(modeId, newName);
    setNewName('');
  };

  const handleCancel = () => {
    setNewName('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <UnifiedModal
      title="重命名模式"
      inputs={[
        {
          label: '模式名称:',
          type: 'text',
          value: newName,
          onChange: setNewName,
          placeholder: '请输入新的模式名称',
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

export default RenameModeModal;
