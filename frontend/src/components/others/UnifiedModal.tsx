import { useEffect, useRef, useState } from 'react';

interface Button {
  text: string;
  onClick: () => void;
  className?: string;
}

interface SelectOption {
  label: string;
  value: string;
}

interface InputField {
  label: string;
  type?: 'text' | 'password' | 'select';
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  options?: (string | SelectOption)[];
  autocompleteOptions?: string[];
  onAutocompleteSelect?: (value: string) => void;
}

interface UnifiedModalProps {
  title?: string;
  message?: string;
  inputs?: InputField[];
  buttons: Button[];
}

const UnifiedModal = ({ title, message, inputs = [], buttons }: UnifiedModalProps) => {
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [focusedButtonIndex, setFocusedButtonIndex] = useState(0);
  const [focusedInputIndex, setFocusedInputIndex] = useState<number | null>(null);

  // 初始焦点设置
  useEffect(() => {
    buttonRefs.current[0]?.focus();
  }, []);

  // 处理键盘事件
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // 焦点在按钮上时的处理
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        event.stopPropagation();
        setFocusedButtonIndex((prev) => (prev === 0 ? buttons.length - 1 : prev - 1));
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        event.stopPropagation();
        setFocusedButtonIndex((prev) => (prev === buttons.length - 1 ? 0 : prev + 1));
      } else if (event.key === 'Enter') {
        event.preventDefault();
        event.stopPropagation();
        buttons[focusedButtonIndex]?.onClick();
      } else if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        // 默认按最后一个按钮（通常是取消）
        buttons[buttons.length - 1]?.onClick();
      }
    };

    // 在捕获阶段监听，避免浏览器默认行为干扰
    document.addEventListener('keydown', handleKeyDown, { capture: true });
    
    // 清理函数：移除事件监听器
    return () => {
      document.removeEventListener('keydown', handleKeyDown, { capture: true });
    };
  }, [focusedButtonIndex, buttons]);

  return (
    <div className="fixed top-0 left-0 right-0 bottom-0 flex justify-center items-center z-[1000]">
      <div className="bg-theme-gray1 rounded-medium shadow-medium px-5 py-3.75 max-w-[500px] w-[400px] text-theme-white">
        {title && <h3 className="m-0 text-theme-white text-lg mb-3.75">{title}</h3>}
        {message && <p className="m-0">{message}</p>}
        {inputs.length > 0 && (
          <form className="mt-3.75">
            {inputs.map((input, index) => (
              <div key={index} className="mb-3.75">
                <label htmlFor={`input-${index}`} className="block mb-1.25 text-theme-white">
                  {input.label}
                  {input.required && <span className="text-theme-green ml-1">*</span>}
                </label>
                {input.type === 'select' ? (
                  <select
                    id={`input-${index}`}
                    className="w-full p-2 bg-theme-gray1 text-theme-white border border-theme-gray1 rounded-small box-border focus:outline-none focus:border-theme-green"
                    value={input.value}
                    onChange={(e) => input.onChange(e.target.value)}
                    required={input.required}
                  >
                    {input.options?.map((option, optIndex) => {
                      const isString = typeof option === 'string';
                      const label = isString ? option : option.label;
                      const value = isString ? option : option.value;
                      return (
                        <option key={optIndex} value={value}>{label}</option>
                      );
                    })}
                  </select>
                ) : (
                  <div className="relative">
                    <input
                      type={input.type || 'text'}
                      id={`input-${index}`}
                      className="w-full p-2 bg-theme-gray1 text-theme-white border border-theme-gray1 rounded-small box-border focus:outline-none focus:border-theme-green"
                      value={input.value}
                      onChange={(e) => input.onChange(e.target.value)}
                      placeholder={input.placeholder}
                      required={input.required}
                      onFocus={() => setFocusedInputIndex(index)}
                      onBlur={() => setFocusedInputIndex(null)}
                    />
                    {input.autocompleteOptions && input.autocompleteOptions.length > 0 && focusedInputIndex === index && (
                      <div className="absolute z-10 w-full mt-1 bg-theme-gray2 border border-theme-gray3 rounded max-h-48 overflow-y-auto">
                        {input.autocompleteOptions
                          .filter(option => option.toLowerCase().includes(input.value.toLowerCase()))
                          .map((option, optIndex) => (
                            <div
                              key={optIndex}
                              className="px-3 py-2 hover:bg-theme-green hover:text-theme-white cursor-pointer text-theme-white"
                              onMouseDown={(e) => {
                                e.preventDefault();
                                input.onAutocompleteSelect?.(option);
                              }}
                            >
                              {option}
                            </div>
                          ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </form>
        )}
        <div className="flex justify-end gap-2.5 mt-5">
          {buttons.map((button: Button, index: number) => (
            <button
              key={index}
              ref={(el) => {
                buttonRefs.current[index] = el;
              }}
              type="button"
              onClick={button.onClick}
              onFocus={() => setFocusedButtonIndex(index)}
              className={`px-4 py-2 border-none rounded-small cursor-pointer text-sm text-white hover:opacity-90 ${button.className || 'bg-gray-600'} ${focusedButtonIndex === index ? 'border-2 border-theme-white shadow-light' : ''}`}
              tabIndex={0}
            >
              {button.text}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default UnifiedModal;
