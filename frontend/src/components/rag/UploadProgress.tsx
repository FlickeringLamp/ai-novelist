import { useState, useEffect, useRef, forwardRef, useImperativeHandle } from "react";
import { useSelector, useDispatch } from "react-redux";
import type { RootState } from "../../store/store";
import {
  incrementFileRefreshTrigger,
  setUploadProgress,
  setUploading
} from "../../store/knowledge";
import httpClient from "../../utils/httpClient";

export interface UploadProgressRef {
  triggerFileInput: () => void;
}

const UploadProgress = forwardRef<UploadProgressRef>((props, ref) => {
  const dispatch = useDispatch();
  const { selectedKnowledgeBaseId, uploadProgress, uploading } = useSelector((state: RootState) => state.knowledgeSlice);
  const wsRef = useRef<WebSocket | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [currentUploadingKbId, setCurrentUploadingKbId] = useState<string | null>(null);

  // 获取当前选中知识库的进度和上传状态
  const currentUploadProgress = selectedKnowledgeBaseId ? uploadProgress[selectedKnowledgeBaseId] : null;
  const currentUploading = selectedKnowledgeBaseId ? uploading[selectedKnowledgeBaseId] : false;

  // 上传文件到知识库
  const uploadFileToKnowledgeBase = async (file: File) => {
    if (!selectedKnowledgeBaseId) return;
    
    try {
      setCurrentUploadingKbId(selectedKnowledgeBaseId);
      dispatch(setUploading({ knowledgeBaseId: selectedKnowledgeBaseId, uploading: true }));
      dispatch(setUploadProgress({
        knowledgeBaseId: selectedKnowledgeBaseId,
        progress: {
          current: 0,
          total: 100,
          percentage: 0,
          message: `正在建立连接...`
        }
      }));
      
      const wsProtocol = 'ws:';
      const wsUrl = `${wsProtocol}//localhost:8000/api/knowledge/bases/${selectedKnowledgeBaseId}/progress`;
      
      await new Promise<void>((resolve, reject) => {
        wsRef.current = new WebSocket(wsUrl);
        
        wsRef.current.onopen = () => {
          console.log('WebSocket 连接已建立');
          resolve();
        };
        
        wsRef.current.onmessage = (event) => {
          const data = JSON.parse(event.data);
          dispatch(setUploadProgress({
            knowledgeBaseId: selectedKnowledgeBaseId,
            progress: data
          }));
          console.log('进度更新:', data);
        };
        
        wsRef.current.onerror = (error) => {
          console.error('WebSocket 错误:', error);
          reject(error);
        };
        
        wsRef.current.onclose = () => {
          console.log('WebSocket 连接已关闭');
        };
        
        setTimeout(() => {
          if (wsRef.current?.readyState !== WebSocket.OPEN) {
            reject(new Error('WebSocket 连接超时'));
          }
        }, 5000);
      });
      
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
      
      dispatch(setUploadProgress({
        knowledgeBaseId: selectedKnowledgeBaseId,
        progress: {
          current: 0,
          total: 100,
          percentage: 0,
          message: `文件 "${file.name}" 已开始上传，正在后台处理...`
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
      if (fileInputRef.current) {
        fileInputRef.current.click();
      }
    }
  }));

  // 监听上传完成
  useEffect(() => {
    if (currentUploadProgress?.percentage === 100) {
      if (selectedKnowledgeBaseId) {
        dispatch(setUploading({ knowledgeBaseId: selectedKnowledgeBaseId, uploading: false }));
      }
      
      setTimeout(() => {
        if (wsRef.current) {
          wsRef.current.close();
          wsRef.current = null;
        }
        if (selectedKnowledgeBaseId) {
          dispatch(setUploadProgress({ knowledgeBaseId: selectedKnowledgeBaseId, progress: null }));
        }
        
        dispatch(incrementFileRefreshTrigger());
        setCurrentUploadingKbId(null);
      }, 2000);
    }
  }, [currentUploadProgress, dispatch, selectedKnowledgeBaseId]);

  if (!currentUploading || !currentUploadProgress) {
    return (
      <div className="h-full p-2 border-t border-theme-gray3 bg-theme-gray1">
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) {
              uploadFileToKnowledgeBase(file);
            }
          }}
        />
      </div>
    );
  }

  return (
    <>
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
        
        {/* 隐藏的文件输入 */}
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) {
              uploadFileToKnowledgeBase(file);
            }
          }}
        />
      </div>
    </>
  );
});

UploadProgress.displayName = 'UploadProgress';

export default UploadProgress;
