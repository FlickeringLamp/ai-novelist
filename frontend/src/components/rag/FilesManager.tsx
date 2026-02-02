import { useState, useEffect } from "react";
import { useSelector } from "react-redux";
import type { RootState } from "../../store/store";
import httpClient from "../../utils/httpClient";
import UnifiedModal from "../others/UnifiedModal";

const FilesManager = () => {
  const { selectedKnowledgeBaseId, fileRefreshTrigger } = useSelector((state: RootState) => state.knowledgeSlice);
  const [files, setFiles] = useState<Array<{ name: string; chunkCount: number }>>([]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showDeleteError, setShowDeleteError] = useState(false);
  const [fileToDelete, setFileToDelete] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState("");

  // 加载知识库的文件列表
  const loadKnowledgeBaseFiles = async (kbId: string) => {
    try {
      const fileChunkCounts = await httpClient.get(`/api/knowledge/bases/${kbId}/files`);
      if (fileChunkCounts && typeof fileChunkCounts === 'object') {
        setFiles(Object.entries(fileChunkCounts).map(([name, chunkCount]) => ({ name, chunkCount: chunkCount as number })));
      }
    } catch (error) {
      console.error('加载文件列表失败:', error);
      setFiles([]);
    }
  };

  // 删除知识库中的文件
  const deleteFileFromKnowledgeBase = async (filename: string) => {
    try {
      await httpClient.delete(`/api/knowledge/bases/${selectedKnowledgeBaseId}/files/${filename}`);
      
      setShowDeleteConfirm(false);
      setFileToDelete("");
      
      if (selectedKnowledgeBaseId) {
        await loadKnowledgeBaseFiles(selectedKnowledgeBaseId);
      }
    } catch (error) {
      setShowDeleteConfirm(false);
      setErrorMessage(`删除失败: ${(error as Error).message}`);
      setShowDeleteError(true);
    }
  };

  // 处理删除按钮点击
  const handleDeleteClick = (filename: string) => {
    setFileToDelete(filename);
    setShowDeleteConfirm(true);
  };

  // 当选中的知识库变化或刷新触发器变化时，加载文件列表
  useEffect(() => {
    if (selectedKnowledgeBaseId) {
      loadKnowledgeBaseFiles(selectedKnowledgeBaseId);
    }
  }, [selectedKnowledgeBaseId, fileRefreshTrigger]);

  if (!selectedKnowledgeBaseId) {
    return (
      <div className="flex items-center justify-center h-full text-theme-green">
        请从左侧选择一个知识库
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-4">
      {files.length === 0 ? (
        <div className="flex items-center justify-center h-full text-theme-gray4">
          暂无文件信息
        </div>
      ) : (
        <div className="space-y-2">
          {files.map((file, index) => (
            <div
              key={index}
              className="p-3 rounded border border-theme-gray3 hover:bg-theme-gray2 flex justify-between items-center"
            >
              <div>
                <div className="font-medium">{file.name}</div>
                <div className="text-sm text-theme-gray4">{file.chunkCount} 个文本片段</div>
              </div>
              <button
                onClick={() => handleDeleteClick(file.name)}
                className="px-3 py-1 text-sm rounded bg-theme-green text-white"
              >
                删除
              </button>
            </div>
          ))}
        </div>
      )}
      
      {/* 确认删除弹窗 */}
      {showDeleteConfirm && (
        <UnifiedModal
          title="确认删除"
          message={`确定要删除文件 "${fileToDelete}" 吗？此操作不可恢复。`}
          buttons={[
            {
              text: "取消",
              onClick: () => {
                setShowDeleteConfirm(false);
                setFileToDelete("");
              },
              className: "bg-theme-gray2"
            },
            {
              text: "删除",
              onClick: () => deleteFileFromKnowledgeBase(fileToDelete),
              className: "bg-theme-green"
            }
          ]}
        />
      )}

      {/* 删除失败弹窗 */}
      {showDeleteError && (
        <UnifiedModal
          title="删除失败"
          message={errorMessage}
          buttons={[
            {
              text: "确定",
              onClick: () => {
                setShowDeleteError(false);
                setErrorMessage("");
              },
              className: "bg-theme-green"
            }
          ]}
        />
      )}
    </div>
  );
};

export default FilesManager;
