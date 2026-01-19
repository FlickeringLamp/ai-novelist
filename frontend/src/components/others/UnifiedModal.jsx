import { useCallback, useEffect, useRef, useState } from 'react';

const UnifiedModal = ({
  message,
  confirmText = '确定',
  cancelText = '取消',
  onConfirm,
  onCancel
}) => {
  const confirmButtonRef = useRef(null);
  const cancelButtonRef = useRef(null);
  const [focusedButton, setFocusedButton] = useState('confirm');

  // 初始焦点设置
  useEffect(() => {
    confirmButtonRef.current?.focus();
  }, []);

  // 处理键盘事件（使用 document.addEventListener 在捕获阶段拦截）
  useEffect(() => {
    const handleKeyDown = (event) => {
      // 支持左右箭头切换焦点
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault();
        event.stopPropagation();
        setFocusedButton((prev) => (prev === 'confirm' ? 'cancel' : 'confirm'));
      } else if (event.key === 'Enter') {
        event.preventDefault();
        event.stopPropagation();
        if (focusedButton === 'confirm') {
          onConfirm();
        } else {
          onCancel();
        }
      } else if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        onCancel();
      }
    };

    // 在捕获阶段监听，避免浏览器默认行为干扰
    document.addEventListener('keydown', handleKeyDown, { capture: true });
    
    // 清理函数：移除事件监听器
    return () => {
      document.removeEventListener('keydown', handleKeyDown, { capture: true });
    };
  }, [focusedButton, onConfirm, onCancel]);

  // 根据焦点状态更新焦点（使用 ref 安全操作 DOM）
  useEffect(() => {
    if (focusedButton === 'confirm') {
      confirmButtonRef.current?.focus();
    } else {
      cancelButtonRef.current?.focus();
    }
  }, [focusedButton]);

  return (
    <div className="fixed top-0 left-0 right-0 bottom-0 bg-black/50 flex justify-center items-center z-[1000]">
      <div className="bg-theme-gray1 rounded-medium shadow-medium px-5 py-3.75 max-w-[500px] w-[400px] text-theme-white">
        <p className="m-0">{message}</p>
        <div className="flex justify-end gap-2.5 mt-5">
          <button
            ref={confirmButtonRef}
            type="button"
            onClick={onConfirm}
            onFocus={() => setFocusedButton('confirm')}
            className={`px-4 py-2 border-none rounded-small cursor-pointer text-sm bg-theme-green text-white hover:bg-theme-green ${focusedButton === 'confirm' ? 'border-2 border-theme-white shadow-light' : ''}`}
            tabIndex={0}
          >
            {confirmText}
          </button>
          <button
            ref={cancelButtonRef}
            type="button"
            onClick={onCancel}
            onFocus={() => setFocusedButton('cancel')}
            className={`px-4 py-2 border-none rounded-small cursor-pointer text-sm bg-gray-600 text-white hover:bg-gray-700 ${focusedButton === 'cancel' ? 'border-2 border-theme-white shadow-light' : ''}`}
            tabIndex={0}
          >
            {cancelText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default UnifiedModal;
