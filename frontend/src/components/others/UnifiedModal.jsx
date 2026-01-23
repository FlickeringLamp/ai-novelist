import { useEffect, useRef, useState } from 'react';

const UnifiedModal = ({ message, buttons }) => {
  const buttonRefs = useRef([]);
  const [focusedButtonIndex, setFocusedButtonIndex] = useState(0);

  // 初始焦点设置
  useEffect(() => {
    buttonRefs.current[0]?.focus();
  }, []);

  // 处理键盘事件
  useEffect(() => {
    const handleKeyDown = (event) => {
      // 支持左右箭头切换焦点
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
        buttons[focusedButtonIndex].onClick();
      } else if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        // 默认按最后一个按钮（通常是取消）
        buttons[buttons.length - 1].onClick();
      }
    };

    // 在捕获阶段监听，避免浏览器默认行为干扰
    document.addEventListener('keydown', handleKeyDown, { capture: true });
    
    // 清理函数：移除事件监听器
    return () => {
      document.removeEventListener('keydown', handleKeyDown, { capture: true });
    };
  }, [focusedButtonIndex, buttons]);

  // 根据焦点状态更新焦点
  useEffect(() => {
    buttonRefs.current[focusedButtonIndex]?.focus();
  }, [focusedButtonIndex]);

  return (
    <div className="fixed top-0 left-0 right-0 bottom-0 bg-black/50 flex justify-center items-center z-[1000]">
      <div className="bg-theme-gray1 rounded-medium shadow-medium px-5 py-3.75 max-w-[500px] w-[400px] text-theme-white">
        <p className="m-0">{message}</p>
        <div className="flex justify-end gap-2.5 mt-5">
          {buttons.map((button, index) => (
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
