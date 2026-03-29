import { useEffect, forwardRef, useImperativeHandle, useCallback } from "react";
import { useSelector, useDispatch } from "react-redux";
import type { RootState, UploadProgressRef, WSMessage } from "../../types";
import {
  incrementFileRefreshTrigger,
  setUploadProgress,
  setUploading
} from "../../store/knowledge";
import httpClient from "../../utils/httpClient";
import wsClient from "../../utils/wsClient";

export type { UploadProgressRef };

const UploadProgress = forwardRef<UploadProgressRef>((_, ref) => {
  const dispatch = useDispatch();
  const { selectedKnowledgeBaseId, uploadProgress, uploading } = useSelector((state: RootState) => state.knowledgeSlice);

  // 获取当前选中知识库的进度和上传状态
  const currentUploadProgress = selectedKnowledgeBaseId ? uploadProgress[selectedKnowledgeBaseId] : null;
  const currentUploading = selectedKnowledgeBaseId ? uploading[selectedKnowledgeBaseId] : false;

  // 处理嵌入进度消息
  const handleEmbeddingProgress = useCallback((message: WSMessage) => {
    if (message.type !== 'embedding_progress') return;
    
    const { kb_id, current, total, percentage, message: msg } = message.payload;
    
    // 只处理当前选中知识库的进度
    if (kb_id === selectedKnowledgeBaseId) {
      dispatch(setUploadProgress({
        knowledgeBaseId: kb_id,
        progress: {
          current,
          total,
          percentage,
          message: msg
        }
      }));
    }
  }, [dispatch, selectedKnowledgeBaseId]);

  // 上传文件到知识库
  const uploadFileToKnowledgeBase = async (file: File) => {
    if (!selectedKnowledgeBaseId) return;
    
    try {
      dispatch(setUploading({ knowledgeBaseId: selectedKnowledgeBaseId, uploading: true }));
      dispatch(setUploadProgress({
        knowledgeBaseId: selectedKnowledgeBaseId,
        progress: {
          current: 0,
          total: 100,
          percentage: 0,
          message: `正在上传文件 "${file.name}"...`
        }
      }));
      
      const formData = new FormData();
      formData.append('file', file);
      
      await httpClient.upload(`/api/knowledge/bases/${selectedKnowledgeBaseId}/files`, formData);
      
      // 上传成功后，等待后台处理完成的进度消息
      dispatch(setUploadProgress({
        knowledgeBaseId: selectedKnowledgeBaseId,
        progress: {
          current: 0,
          total: 100,
          percentage: 0,
          message: `文件 "${file.name}" 已上传，正在处理...`
        }
      }));
      
    } catch (error) {
      console.error('上传失败:', error);
      if (selectedKnowledgeBaseId) {
        dispatch(setUploading({ knowledgeBaseId: selectedKnowledgeBaseId, uploading: false }));
        dispatch(setUploadProgress({ knowledgeBaseId: selectedKnowledgeBaseId, progress: null }));
      }
    }
  };

  // 暴露方法给父组件
  useImperativeHandle(ref, () => ({
    triggerFileInput: () => {
      // 触发文件选择
      const input = document.createElement('input');
      input.type = 'file';
      input.style.display = 'none';
      input.onchange = (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (file) {
          uploadFileToKnowledgeBase(file);
        }
      };
      document.body.appendChild(input);
      input.click();
      document.body.removeChild(input);
    }
  }));

// 订阅 WebSocket 消息
useEffect(() => {
  if (!currentUploading) return;

  // 订阅嵌入进度消息
  const unsubscribe = wsClient.onMessage(handleEmbeddingProgress);
  
  return () => {
    unsubscribe();
  };
}, [currentUploading, handleEmbeddingProgress]);

  // 监听上传完成
  useEffect(() => {
    if (currentUploadProgress?.percentage === 100) {
      if (selectedKnowledgeBaseId) {
        dispatch(setUploading({ knowledgeBaseId: selectedKnowledgeBaseId, uploading: false }));
      }
      
      setTimeout(() => {
        if (selectedKnowledgeBaseId) {
          dispatch(setUploadProgress({ knowledgeBaseId: selectedKnowledgeBaseId, progress: null }));
        }
        dispatch(incrementFileRefreshTrigger());
      }, 2000);
    }
  }, [currentUploadProgress, dispatch, selectedKnowledgeBaseId]);

  if (!currentUploading || !currentUploadProgress) {
    return null;
  }

  return (
    <div className="h-full p-2 border-t border-theme-gray3 bg-theme-gray1 flex items-center">
      <div className="flex items-center gap-2 w-full">
        <div className="text-xs text-theme-gray4 truncate flex-shrink-0">{currentUploadProgress.message}</div>
        <div className="flex-1 bg-theme-gray3 rounded-full h-2">
          <div
            className="bg-theme-green h-2 rounded-full transition-all duration-300"
            style={{ width: `${currentUploadProgress.percentage}%` }}
          ></div>
        </div>
        <span className="text-xs text-theme-gray4 flex-shrink-0">{currentUploadProgress.percentage.toFixed(1)}%</span>
      </div>
    </div>
  );
});

UploadProgress.displayName = 'UploadProgress';

export default UploadProgress;
