import { useState, useEffect } from "react";
import { useSelector } from "react-redux";
import type { RootState } from "../../store/store";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faTrash, faPlus } from '@fortawesome/free-solid-svg-icons'
import httpClient from "../../utils/httpClient";
import UnifiedModal from "../others/UnifiedModal";
import type { UploadProgressRef } from "./UploadProgress";

interface SearchResult {
  content: string;
  metadata: Record<string, any>;
  score: number;
}

interface FilesManagerProps {
  uploadProgressRef: React.RefObject<UploadProgressRef | null>;
}

const FilesManager = ({ uploadProgressRef }: FilesManagerProps) => {
  const { selectedKnowledgeBaseId, fileRefreshTrigger } = useSelector((state: RootState) => state.knowledgeSlice);
  const [files, setFiles] = useState<Array<{ name: string; chunkCount: number; chunkSize?: number; chunkOverlap?: number }>>([]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showDeleteError, setShowDeleteError] = useState(false);
  const [fileToDelete, setFileToDelete] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState("");
  
  // 文件内搜索状态
  const [fileSearchQueries, setFileSearchQueries] = useState<Record<string, string>>({});
  const [fileSearchResults, setFileSearchResults] = useState<Record<string, SearchResult[]>>({});
  const [isFileSearching, setIsFileSearching] = useState<Record<string, boolean>>({});
  const [showFileSearchResults, setShowFileSearchResults] = useState<Record<string, boolean>>({});

  // 加载知识库的文件列表
  const loadKnowledgeBaseFiles = async (kbId: string) => {
    try {
      const fileChunkCounts = await httpClient.get(`/api/knowledge/bases/${kbId}/files`);
      if (fileChunkCounts && typeof fileChunkCounts === 'object') {
        setFiles(Object.entries(fileChunkCounts).map(([name, info]) => ({
          name,
          chunkCount: (info as any).chunk_count,
          chunkSize: (info as any).chunk_size,
          chunkOverlap: (info as any).chunk_overlap
        })));
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

  // 文件内搜索
  const handleFileSearch = async (filename: string) => {
    const query = fileSearchQueries[filename];
    if (!query?.trim() || !selectedKnowledgeBaseId) return;
    
    setIsFileSearching(prev => ({ ...prev, [filename]: true }));
    setShowFileSearchResults(prev => ({ ...prev, [filename]: true }));
    try {
      const response = await httpClient.post(`/api/knowledge/bases/${selectedKnowledgeBaseId}/asearch`, {
        query: query,
        filename_filter: filename
      });
      setFileSearchResults(prev => ({ ...prev, [filename]: response.results || [] }));
    } catch (error) {
      console.error('文件搜索失败:', error);
      setFileSearchResults(prev => ({ ...prev, [filename]: [] }));
    } finally {
      setIsFileSearching(prev => ({ ...prev, [filename]: false }));
    }
  };

  // 关闭文件搜索结果
  const closeFileSearchResults = (filename: string) => {
    setShowFileSearchResults(prev => ({ ...prev, [filename]: false }));
    setFileSearchResults(prev => ({ ...prev, [filename]: [] }));
    setFileSearchQueries(prev => ({ ...prev, [filename]: "" }));
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
      {/* 添加按钮 */}
      <div className="mb-4 flex justify-end">
        <div className="flex gap-2">
          <button
            onClick={() => {
              uploadProgressRef.current?.triggerFileInput();
            }}
            className="text-theme-white hover:text-theme-green"
          >
            <FontAwesomeIcon icon={faPlus}/>
          </button>
        </div>
      </div>

      {files.length === 0 ? (
        <div className="flex items-center justify-center h-full text-theme-gray4">
          暂无文件信息
        </div>
      ) : (
        <div className="space-y-2">
          {files.map((file, index) => (
            <div key={index}>
              {/* 文件项 */}
              <div className="p-3 rounded border border-theme-gray3 hover:bg-theme-gray2">
                <div className="flex justify-between items-center">
                  <div>
                    <div className="font-medium">{file.name}</div>
                    <div className="text-sm text-theme-gray4">
                      {file.chunkCount} 个文本片段 | 分段: {file.chunkSize} | 重叠: {file.chunkOverlap}
                    </div>
                  </div>
                  
                  {/* 文件内搜索框 */}
                  <input
                    type="text"
                    placeholder={`搜索文件内容...`}
                    value={fileSearchQueries[file.name] || ""}
                    onChange={(e) => setFileSearchQueries(prev => ({ ...prev, [file.name]: e.target.value }))}
                    onKeyPress={(e) => e.key === 'Enter' && handleFileSearch(file.name)}
                    className="flex-1 ml-20 px-3 py-1.5 rounded border border-theme-gray3 bg-theme-gray1 text-theme-white text-sm focus:outline-none focus:border-theme-green"
                  />
                  
                  <button
                    onClick={() => handleDeleteClick(file.name)}
                    className="p-2 border-none text-theme-white hover:text-theme-green"
                  >
                    <FontAwesomeIcon icon={faTrash} />
                  </button>
                </div>
              </div>

              {/* 文件内搜索结果 */}
              {showFileSearchResults[file.name] && (
                <div className="mt-2 p-3 rounded border border-theme-gray3 bg-theme-gray2">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-medium text-sm">搜索结果 ({(fileSearchResults[file.name] || []).length}条)</span>
                    <button
                      onClick={() => closeFileSearchResults(file.name)}
                      className="text-sm text-theme-gray4 hover:text-theme-white"
                    >
                      关闭
                    </button>
                  </div>
                  {isFileSearching[file.name] ? (
                    <div className="text-center text-theme-gray4 text-sm">搜索中...</div>
                  ) : (fileSearchResults[file.name] || []).length === 0 ? (
                    <div className="text-center text-theme-gray4 text-sm">未找到相关结果</div>
                  ) : (
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {(fileSearchResults[file.name] || []).map((result, idx) => (
                        <div key={idx} className="p-2 rounded bg-theme-gray1">
                          <div className="text-xs text-theme-gray4 mb-1">
                            相似度: {(result.score * 100).toFixed(1)}%
                          </div>
                          <div className="text-sm">{result.content}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
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
