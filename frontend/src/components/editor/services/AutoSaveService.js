import { useCallback } from 'react';
import httpClient from '../../../utils/httpClient';
import tabStateService from '../../../services/tabStateService';

/**
 * 手动保存服务 Hook
 * 处理手动保存逻辑和保存状态管理
 */
export const useManualSave = (activeTab, isSaving, setIsSaving, setLastSavedTime, setModalMessage, setShowModal) => {

  const saveContent = useCallback(
    async (isManualSave = false) => {
      if (!activeTab || !activeTab.isDirty) {
        console.log('[ManualSave] 无需保存：没有激活的标签页或内容未修改。');
        return { success: true };
      }

      const { id: filePath, content } = activeTab;

      console.log('[ManualSave] 尝试保存文件，filePath:', filePath);

      if (!filePath) {
        console.warn('无法保存文件：文件路径无效。', filePath);
        return { success: false, error: '文件路径无效。' };
      }

      if (isSaving) {
        console.log('[ManualSave] 正在保存中，跳过重复请求');
        return { success: true };
      }

      setIsSaving(true);

      try {
        await httpClient.put(`/api/file/write/${encodeURIComponent(filePath)}`, {
          content
        });
        console.log('[ManualSave] 文件保存成功！');
        tabStateService.updateTabContent(filePath, content, false);
        setLastSavedTime(new Date());
        if (isManualSave) {
          setModalMessage('文件保存成功！');
          setShowModal(true);
        }
        return { success: true };
      } catch (error) {
        console.error('保存过程中发生异常:', error);
        if (isManualSave) {
           setModalMessage(`保存过程中发生异常: ${error.message}`);
           setShowModal(true);
        }
        return { success: false, error: error.message };
      } finally {
        setIsSaving(false);
      }
    },
    [activeTab, isSaving]
  );

  return {
    saveContent
  };
};
