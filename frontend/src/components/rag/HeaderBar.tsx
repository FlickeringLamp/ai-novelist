import { useState } from "react";
import { useSelector } from "react-redux";
import type { RootState } from "../../store/store";
import BaseDetailModal from "./modals/BaseDetailModal";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faGear } from '@fortawesome/free-solid-svg-icons';
import httpClient from "../../utils/httpClient";

interface SearchResult {
  content: string;
  metadata: Record<string, any>;
  score: number;
}

interface HeaderBarProps {}

const HeaderBar = ({}: HeaderBarProps) => {
  const {
    knowledgeBases,
    selectedKnowledgeBaseId
  } = useSelector(
    (state: RootState) => state.knowledgeSlice
  );

  const [showDetailModal, setShowDetailModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult[] | null>(null);
  const [showSearchResults, setShowSearchResults] = useState(false);

  //"守卫子句"，当没有选中东西的时候，不应该渲染。
  if (!selectedKnowledgeBaseId) {
    return null;
  }

  const handleSearch = async () => {
    if (!searchQuery.trim() || !selectedKnowledgeBaseId) return;
    
    setIsSearching(true);
    setShowSearchResults(true);
    try {
      const response = await httpClient.post(`/api/knowledge/bases/${selectedKnowledgeBaseId}/asearch`, {
        query: searchQuery
      });
      setSearchResults(response.results || []);
    } catch (error) {
      console.error('搜索失败:', error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleCloseSearchResults = () => {
    setShowSearchResults(false);
    setSearchResults(null);
    setSearchQuery('');
  };

  return (
    <>
      <div className="h-[5%] border-b border-theme-gray3 flex items-center justify-between px-4">
        <h2 className="text-xl font-bold">{knowledgeBases[selectedKnowledgeBaseId]?.name}</h2>
        <div className="flex gap-5 items-center flex-1">
          {/* 知识库搜索框 */}
          <input
            type="text"
            placeholder="搜索知识库内容..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            className="flex-1 ml-20 px-3 py-1.5 rounded border border-theme-gray3 bg-theme-gray1 text-theme-white text-sm focus:outline-none focus:border-theme-green"
          />
          <button
            onClick={() => setShowDetailModal(true)}
            className="hover:text-theme-green"
          >
            <FontAwesomeIcon icon={faGear} className="text-xl"/>
          </button>
        </div>
      </div>

      {/* 搜索结果面板 */}
      {showSearchResults && (
        <div className="absolute top-[5%] left-0 right-0 bg-theme-gray2 border-b border-theme-gray3 z-50">
          <div className="p-4">
            <div className="flex justify-between items-center mb-2">
              <span className="font-medium">搜索结果 ({(searchResults || []).length}条)</span>
              <button
                onClick={handleCloseSearchResults}
                className="text-sm text-theme-gray4 hover:text-theme-white"
              >
                关闭
              </button>
            </div>
            {isSearching ? (
              <div className="text-center text-theme-gray4">搜索中...</div>
            ) : (searchResults || []).length === 0 ? (
              <div className="text-center text-theme-gray4">未找到相关结果</div>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {(searchResults || []).map((result, index) => (
                  <div key={index} className="p-2 rounded bg-theme-gray1">
                    <div className="text-xs text-theme-gray4 mb-1">
                      相似度: {(result.score * 100).toFixed(1)}% | 文件: {result.metadata.original_filename || '未知'}
                    </div>
                    <div className="text-sm">{result.content}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 知识库详情弹窗 */}
      <BaseDetailModal
        isOpen={showDetailModal}
        knowledgeBaseId={selectedKnowledgeBaseId}
        onClose={() => setShowDetailModal(false)}
      />
    </>
  );
};

export default HeaderBar;
