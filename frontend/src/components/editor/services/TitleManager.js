import { useCallback } from 'react';
import tabStateService from '../../../services/tabStateService';
import httpClient from '../../../utils/httpClient.js';

/**
 * 标题管理 Hook
 * 处理标题编辑和保存逻辑
 */
export const useTitleManager = (activeTab, title, setTitle, setIsTitleEditing) => {
  const handleTitleSave = useCallback(async () => {
    if (!activeTab) return;

    const pureCurrentTitle = activeTab.title;

    if (title && title !== pureCurrentTitle) {
      try {
        await httpClient.post('/api/file/rename', {
          old_path: activeTab.id,
          new_name: title
        });
        tabStateService.fileRenamed(activeTab.id, title);
        console.log('标题保存成功:', title);
      } catch (error) {
        console.error('标题保存失败:', error);
      }
    }
    setIsTitleEditing(false);
  }, [title, activeTab?.id, activeTab?.title]);

  const handleTitleKeyDown = useCallback(async (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      await handleTitleSave();
    }
  }, [handleTitleSave]);

  const handleTitleFocus = useCallback(() => {
    if (title === '未命名') {
      setTitle('');
    }
  }, [title, setTitle]);

  return {
    handleTitleSave,
    handleTitleKeyDown,
    handleTitleFocus
  };
};