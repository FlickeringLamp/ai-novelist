import React from 'react';
import UnifiedModal from './UnifiedModal';

/**
 * ModalManager - 模态框管理模块
 * 统一管理通知模态框、确认模态框
 */
const ModalManager = ({
  // 通知模态框相关属性
  showNotificationModal,
  notificationMessage,
  onNotificationClose,
  
  // 确认模态框相关属性
  showConfirmationModal,
  confirmationMessage,
  onConfirm,
  onCancel
}) => {
  return (
    <>
      {/* 通知模态框（单按钮模式） */}
      {showNotificationModal && (
        <UnifiedModal
          message={notificationMessage}
          showCancelButton={false}
          onConfirm={onNotificationClose}
        />
      )}

      {/* 确认模态框（双按钮模式） */}
      {showConfirmationModal && (
        <UnifiedModal
          message={confirmationMessage}
          showCancelButton={true}
          onConfirm={onConfirm}
          onCancel={onCancel}
        />
      )}
    </>
  );
};

export default ModalManager;