import { useState, useEffect } from 'react';
import UnifiedModal from '../../others/UnifiedModal';

interface RenameKnowledgeBaseModalProps {
  isOpen: boolean;
  knowledgeBaseId: string;
  currentName: string;
  onClose: () => void;
  onSubmit: (knowledgeBaseId: string, newName: string) => Promise<void>;
}

const RenameKnowledgeBaseModal = ({
  isOpen,
  knowledgeBaseId,
  currentName,
  onClose,
  onSubmit
}: RenameKnowledgeBaseModalProps) => {
  const [newKnowledgeBaseName, setNewKnowledgeBaseName] = useState('');

  useEffect(() => {
    if (isOpen) {
      setNewKnowledgeBaseName(currentName);
    }
  }, [isOpen, currentName]);

  const handleSubmit = async () => {
    await onSubmit(knowledgeBaseId, newKnowledgeBaseName);
    setNewKnowledgeBaseName('');
  };

  const handleCancel = () => {
    setNewKnowledgeBaseName('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <UnifiedModal
      title="重命名知识库"
      inputs={[
        {
          label: '新名称:',
          type: 'text',
          value: newKnowledgeBaseName,
          onChange: setNewKnowledgeBaseName,
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

export default RenameKnowledgeBaseModal;
