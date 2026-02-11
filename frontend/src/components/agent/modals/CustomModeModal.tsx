import { useState } from 'react';
import UnifiedModal from '../../others/UnifiedModal';

interface CustomModeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (name: string) => Promise<void>;
}

const CustomModeModal = ({ isOpen, onClose, onSubmit }: CustomModeModalProps) => {
  const [customModeName, setCustomModeName] = useState('');

  const handleSubmit = async () => {
    await onSubmit(customModeName);
    setCustomModeName('');
  };

  const handleCancel = () => {
    setCustomModeName('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <UnifiedModal
      title="添加自定义模式"
      inputs={[
        {
          label: '模式名称:',
          type: 'text',
          value: customModeName,
          onChange: setCustomModeName,
          placeholder: '例如: 我的模式',
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

export default CustomModeModal;
