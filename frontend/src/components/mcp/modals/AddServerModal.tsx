import { useState } from 'react';
import UnifiedModal from '../../others/UnifiedModal';
import type { MCPServerConfig } from '../../../types/mcp';

interface AddServerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (serverId: string, config: MCPServerConfig) => Promise<void>;
}

const AddServerModal = ({ isOpen, onClose, onSubmit }: AddServerModalProps) => {
  const [serverId, setServerId] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [transport, setTransport] = useState<'stdio' | 'http'>('stdio');
  const [command, setCommand] = useState('');
  const [args, setArgs] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [isActive, setIsActive] = useState(true);

  const handleSubmit = async () => {
    const config: MCPServerConfig = {
      name,
      description,
      baseUrl,
      isActive,
      transport,
      command,
      args: args ? args.split(' ') : [],
      env: {},
    };
    await onSubmit(serverId, config);
    resetForm();
  };

  const handleCancel = () => {
    resetForm();
    onClose();
  };

  const resetForm = () => {
    setServerId('');
    setName('');
    setDescription('');
    setTransport('stdio');
    setCommand('');
    setArgs('');
    setBaseUrl('');
    setIsActive(true);
  };

  if (!isOpen) return null;

  return (
    <UnifiedModal
      title="添加MCP服务器"
      inputs={[
        {
          label: '服务器ID:',
          type: 'text',
          value: serverId,
          onChange: setServerId,
          placeholder: '例如: mcp-server-1',
          required: true
        },
        {
          label: '名称:',
          type: 'text',
          value: name,
          onChange: setName,
          placeholder: '例如: 我的MCP服务器',
          required: true
        },
        {
          label: '描述:',
          type: 'text',
          value: description,
          onChange: setDescription,
          placeholder: '服务器描述'
        },
        {
          label: '传输类型:',
          type: 'select',
          value: transport,
          onChange: (value) => setTransport(value as 'stdio' | 'http'),
          options: [
            { label: 'stdio', value: 'stdio' },
            { label: 'http', value: 'http' }
          ]
        },
        ...(transport === 'stdio' ? [
          {
            label: '命令:',
            type: 'text' as const,
            value: command,
            onChange: setCommand,
            placeholder: '例如: npx'
          },
          {
            label: '参数:',
            type: 'text' as const,
            value: args,
            onChange: setArgs,
            placeholder: '例如: @modelcontextprotocol/server-filesystem'
          }
        ] : [
          {
            label: 'Base URL:',
            type: 'text' as const,
            value: baseUrl,
            onChange: setBaseUrl,
            placeholder: '例如: http://localhost:3000'
          }
        ]),
        {
          label: '激活:',
          type: 'select',
          value: isActive.toString(),
          onChange: (value) => setIsActive(value === 'true'),
          options: [
            { label: '是', value: 'true' },
            { label: '否', value: 'false' }
          ]
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

export default AddServerModal;
