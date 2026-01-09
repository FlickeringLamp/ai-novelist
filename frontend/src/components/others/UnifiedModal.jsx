import React, { useEffect, useRef, useState } from 'react';
import './NotificationModal.css';

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
    <div className="modal-overlay">
      <div className="modal-content">
        <p>{message}</p>
        <div className="modal-actions">
          <button
            ref={confirmButtonRef}
            onClick={onConfirm}
            className={showCancelButton && focusedButton === 'confirm' ? 'focused' : ''}
            tabIndex={0}
          >
            {confirmText}
          </button>
          {showCancelButton && (
            <button
              ref={cancelButtonRef}
              onClick={onCancel}
              className={focusedButton === 'cancel' ? 'focused' : ''}
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
