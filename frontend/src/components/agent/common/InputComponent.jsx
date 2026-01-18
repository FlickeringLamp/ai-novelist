import { useState, useEffect } from 'react';

/**
 * 统一的输入框组件
 * 支持数字输入、标签和描述
 */
const InputComponent = ({
  label,
  value,
  onChange,
  description,
  className = '',
  type = 'number',
  placeholder = '',
  min,
  max,
  step = 1
}) => {
  const [inputValue, setInputValue] = useState(value || '');

  // 同步外部value变化到本地状态
  useEffect(() => {
    console.log(`[InputComponent] 外部value变化:`, value);
    setInputValue(value || '');
  }, [value]);

  const handleChange = (e) => {
    const newValue = e.target.value;
    setInputValue(newValue);

    if (onChange) {
      // 如果是数字类型，转换为数字
      if (type === 'number') {
        const numValue = newValue === '' ? '' : parseFloat(newValue);
        onChange(numValue);
      } else {
        onChange(newValue);
      }
    }
  };

  const handleBlur = () => {
    // 在失去焦点时验证数值范围
    if (type === 'number' && inputValue !== '') {
      let numValue = parseFloat(inputValue);

      if (min !== undefined && numValue < min) {
        numValue = min;
      }
      if (max !== undefined && numValue > max) {
        numValue = max;
      }

      setInputValue(numValue.toString());
      if (onChange) {
        onChange(numValue);
      }
    } else if (type === 'number' && inputValue === '') {
      // 允许空值，直接传递空值给onChange
      if (onChange) {
        onChange('');
      }
    }
  };

  return (
    <div className={`mb-5 ${className}`}>
      {label && (
        <label className="block mb-2 font-medium text-theme-gray">
          {label}
        </label>
      )}

      <div className="mb-1">
        <input
          type={type}
          value={inputValue}
          onChange={handleChange}
          onBlur={handleBlur}
          placeholder={placeholder}
          min={min}
          max={max}
          step={step}
          className="w-full px-3 py-2 bg-theme-gray border border-theme-gray rounded-small text-theme-white text-sm transition-all focus:outline-none focus:border-theme-green focus:ring-2 focus:ring-theme-green/10 hover:border-theme-gray placeholder:text-theme-gray/60"
        />
      </div>

      {description && (
        <div className="text-xs text-theme-gray mt-1 leading-relaxed">
          {description}
        </div>
      )}
    </div>
  );
};

export default InputComponent;
