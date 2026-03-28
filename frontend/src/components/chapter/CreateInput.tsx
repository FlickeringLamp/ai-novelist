import { useEffect, useRef, useState } from 'react';
import type { CreateInputProps } from '../../types';

function CreateInput({ isFolder, onConfirm, onCancel }: CreateInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState('');
  const [showInvalidCharWarning, setShowInvalidCharWarning] = useState(false);

  // 检查是否包含特殊字符
  const containsInvalidChars = (value: string): boolean => {
    const invalidChars = /[*\\/<>:|?"']/;
    return invalidChars.test(value);
  };

  useEffect(() => {
    // 自动聚焦
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
      }
    }, 0);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      onConfirm(value);
    } else if (e.key === 'Escape') {
      onCancel();
    }
  };

  const handleBlur = () => {
    // 失去焦点时，如果值为空则取消，否则创建
    if (value.trim() === '') {
      onCancel();
    } else {
      onConfirm(value);
    }
  };

  return (
    <div className="flex flex-col flex-1">
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => {
          const val = e.target.value;
          setValue(val);
          setShowInvalidCharWarning(containsInvalidChars(val));
        }}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        placeholder={isFolder ? '新建文件夹' : '新建文件'}
        className="chapter-title-input bg-theme-black text-theme-white border border-theme-green text-sm outline-none flex-1"
        onClick={(e) => e.stopPropagation()}
      />
      {showInvalidCharWarning && (
        <span className="text-theme-red text-xs mt-1">不可包含* " \ / {"< >"} : | 特殊字符</span>
      )}
    </div>
  );
}

export default CreateInput;
