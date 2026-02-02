import { useState, useRef, useEffect } from "react";
import { useSelector, useDispatch } from "react-redux";
import type { RootState } from "../../store/store";
import { incrementFileRefreshTrigger } from "../../store/knowledge";
import httpClient from "../../utils/httpClient";
import BaseDetailModal from "./modals/BaseDetailModal";
import UnifiedModal from "../others/UnifiedModal";

interface UploadProgress {
  current: number;
  total: number;
  percentage: number;
  message: string;
}

const HeaderBar = () => {
  const dispatch = useDispatch();
  const { knowledgeBases, selectedKnowledgeBaseId } = useSelector(
    (state: RootState) => state.knowledgeSlice
  );

  const [showDetailModal, setShowDetailModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [modalTitle, setModalTitle] = useState('');
  const [modalMessage, setModalMessage] = useState('');
  const wsRef = useRef<WebSocket | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // 上传文件到知识库
  const uploadFileToKnowledgeBase = async (file: File) => {
    if (!selectedKnowledgeBaseId) return;
    
    try {
      setUploading(true);
      setUploadProgress({
        current: 0,
        total: 100,
        percentage: 0,
        message: `正在建立连接...`
      });
      
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
          setUploadProgress(data);
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
      
      setUploadProgress({
        current: 0,
        total: 100,
        percentage: 0,
        message: `正在上传文件 "${file.name}"...`
      });
      
      const formData = new FormData();
      formData.append('file', file);
      
      await httpClient.upload(`/api/knowledge/bases/${selectedKnowledgeBaseId}/files`, formData);
      
      setUploadProgress({
        current: 0,
        total: 100,
        percentage: 0,
        message: `文件 "${file.name}" 已开始上传，正在后台处理...`
      });
      
    } catch (error) {
      setModalTitle('上传失败');
      setModalMessage(`上传失败: ${(error as Error).message}`);
      setShowModal(true);
      setUploading(false);
      setUploadProgress(null);
    }
  };

  // 监听上传完成
  useEffect(() => {
    if (uploadProgress?.percentage === 100) {
      setModalTitle('上传完成');
      setModalMessage(`文件上传完成: ${uploadProgress.message}`);
      setShowModal(true);
      setUploading(false);
      
      setTimeout(() => {
        if (wsRef.current) {
          wsRef.current.close();
          wsRef.current = null;
        }
        setUploadProgress(null);
        
        dispatch(incrementFileRefreshTrigger());
      }, 2000);
    }
  }, [uploadProgress]);

  //"守卫子句",属于HeaderBar，当没有选中东西的时候，不应该渲染。
  if (!selectedKnowledgeBaseId) {
    return null;
  }

  return (
    <>
      <div className="p-4 border-b border-theme-gray3">
        <div className="flex justify-between items-center mb-2">
          <h2 className="text-xl font-bold">{knowledgeBases[selectedKnowledgeBaseId]?.name}</h2>
          <div className="flex gap-2">
            <button
              onClick={() => setShowDetailModal(true)}
              className="px-4 py-2 rounded bg-theme-gray3 hover:bg-theme-gray2"
            >
              设置
            </button>
            <button
              onClick={() => {
                if (fileInputRef?.current) {
                  fileInputRef.current.click();
                }
              }}
              className="px-4 py-2 rounded bg-theme-green text-white hover:bg-opacity-90"
            >
              添加文件
            </button>
          </div>
        </div>
        
        {/* 上传进度显示 */}
        {uploading && uploadProgress && (
          <div className="mt-2 p-4 rounded border border-theme-green bg-theme-gray1">
            <div className="flex justify-between items-center mb-2">
              <span className="font-medium text-theme-green">上传进度</span>
              <span className="text-sm text-theme-gray4">{uploadProgress.percentage.toFixed(1)}%</span>
            </div>
            <div className="w-full bg-theme-gray3 rounded-full h-2 mb-2">
              <div
                className="bg-theme-green h-2 rounded-full transition-all duration-300"
                style={{ width: `${uploadProgress.percentage}%` }}
              ></div>
            </div>
            <div className="text-sm text-theme-gray4">{uploadProgress.message}</div>
          </div>
        )}
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

      {/* 知识库详情弹窗 */}
      <BaseDetailModal
        isOpen={showDetailModal}
        knowledgeBaseId={selectedKnowledgeBaseId}
        onClose={() => setShowDetailModal(false)}
      />

      {/* 统一模态框 */}
      {showModal && (
        <UnifiedModal
          title={modalTitle}
          message={modalMessage}
          buttons={[
            {
              text: '确定',
              onClick: () => setShowModal(false),
              className: 'bg-theme-green'
            }
          ]}
        />
      )}
    </>
  );
};

export default HeaderBar;
