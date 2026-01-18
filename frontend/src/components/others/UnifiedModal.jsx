import { useEffect, useRef, useState } from 'react';

const UnifiedModal = ({
  message,
  showCancelButton = false,
  confirmText = '确定',
  cancelText = '取消',
  onConfirm,
  onCancel
}) => {
  const confirmButtonRef = useRef(null);
  const cancelButtonRef = useRef(null);
  const [focusedButton, setFocusedButton] = useState('confirm');

  useEffect(() => {
    // 只在双按钮模式下管理焦点
    if (showCancelButton) {
      if (focusedButton === 'confirm') {
        confirmButtonRef.current?.focus();
      } else {
        cancelButtonRef.current?.focus();
      }
    }
  }, [focusedButton, showCancelButton]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (showCancelButton) {
        // 双按钮模式：支持左右箭头切换焦点
        if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
          event.preventDefault();
          setFocusedButton((prev) => (prev === 'confirm' ? 'cancel' : 'confirm'));
        } else if (event.key === 'Enter') {
          event.preventDefault();
          if (focusedButton === 'confirm') {
            onConfirm();
          } else {
            onCancel();
          }
        } else if (event.key === 'Escape') {
          event.preventDefault();
          onCancel();
        }
      } else {
        // 单按钮模式：Enter 或 Esc 都关闭
        if (event.key === 'Enter' || event.key === 'Escape') {
          event.preventDefault();
          onConfirm();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [focusedButton, showCancelButton, onConfirm, onCancel]);

  return (
    <div className="fixed top-0 left-0 right-0 bottom-0 bg-black/50 flex justify-center items-center z-[1000]">
      <div className="bg-theme-gray1 rounded-medium shadow-medium px-5 py-3.75 max-w-[500px] w-[400px] text-theme-gray1">
        <p className="m-0">{message}</p>
        <div className="flex justify-end gap-2.5 mt-5">
          <button
            ref={confirmButtonRef}
            onClick={onConfirm}
            className={`px-4 py-2 border-none rounded-small cursor-pointer text-sm bg-theme-green text-white hover:bg-theme-green ${showCancelButton && focusedButton === 'confirm' ? 'border-2 border-theme-white shadow-light' : ''}`}
            tabIndex={0}
          >
            {confirmText}
          </button>
          {showCancelButton && (
            <button
              ref={cancelButtonRef}
              onClick={onCancel}
              className={`px-4 py-2 border-none rounded-small cursor-pointer text-sm bg-gray-600 text-white hover:bg-gray-700 ${focusedButton === 'cancel' ? 'border-2 border-theme-white shadow-light' : ''}`}
              tabIndex={0}
            >
              {cancelText}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default UnifiedModal;
