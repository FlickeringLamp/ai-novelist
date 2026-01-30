import { useState } from 'react';
import UnifiedModal from '../../others/UnifiedModal';

interface CustomProviderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (name: string) => Promise<void>;
}

const CustomProviderModal = ({ isOpen, onClose, onSubmit }: CustomProviderModalProps) => {
  const [customProviderName, setCustomProviderName] = useState('');

  const handleSubmit = async () => {
    await onSubmit(customProviderName);
    setCustomProviderName('');
  };

  const handleCancel = () => {
    setCustomProviderName('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <UnifiedModal
      title="添加自定义提供商"
      inputs={[
        {
          label: '提供商名称:',
          type: 'text',
          value: customProviderName,
          onChange: setCustomProviderName,
          placeholder: '例如: 我的提供商',
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

export default CustomProviderModal;
