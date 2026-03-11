import { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSearch, faTimes } from '@fortawesome/free-solid-svg-icons';
import httpClient from '../../utils/httpClient';

interface SearchResult {
  path: string;
  content: string[];
}

interface SearchPanelProps {
  onClose?: () => void;
  onFileSelect: (filePath: string) => void;
  embedded?: boolean; // 是否为嵌入模式
}

const SearchPanel = ({ onClose, onFileSelect, embedded = false }: SearchPanelProps) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Record<string, SearchResult>>({});
  const [loading, setLoading] = useState(false);
  const [debouncedQuery, setDebouncedQuery] = useState('');

  // 防抖处理
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  // 搜索功能
  useEffect(() => {
    const performSearch = async () => {
      if (!debouncedQuery.trim()) {
        setResults({});
        return;
      }

      setLoading(true);
      try {
        const response = await httpClient.get(`/api/file/search?query=${encodeURIComponent(debouncedQuery)}`);
        console.log('从后端得到的完整响应:', response);
        // httpClient.get() 直接返回对象，不是包装在 data 属性中
        setResults(typeof response === 'object' && response !== null ? response : {});
      } catch (error) {
        console.error('搜索失败:', error);
        setResults({});
      } finally {
        setLoading(false);
      }
    };

    performSearch();
  }, [debouncedQuery]);

  const handleResultClick = (filePath: string) => {
    onFileSelect(filePath);
    if (onClose) onClose();
  };

  const highlightText = (text: string, query: string) => {
    if (!query) return text;
    const regex = new RegExp(`(${query})`, 'gi');
    return text.replace(regex, '<mark class="bg-theme-green text-theme-black">$1</mark>');
  };

  return (
    <div className={`${embedded ? 'w-full h-full' : 'fixed top-[3%] left-[51px] right-0 bottom-0'} bg-theme-black ${embedded ? '' : 'z-[1000]'} flex flex-col`}>
      {/* 搜索栏头部 */}
      <div className="h-[60px] bg-theme-black border-b border-theme-gray3 flex items-center px-4 gap-3">
        <FontAwesomeIcon icon={faSearch} className="text-theme-green text-lg" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="搜索文件内容..."
          className="flex-1 bg-transparent border-none outline-none text-theme-white text-lg placeholder-theme-gray4"
          autoFocus
        />
        {onClose && (
          <button
            onClick={onClose}
            className="p-2 hover:bg-theme-gray3 rounded transition-colors"
            title="关闭"
          >
            <FontAwesomeIcon icon={faTimes} className="text-theme-white" />
          </button>
        )}
      </div>

      {/* 搜索结果列表 */}
      <div className="flex-1 overflow-y-auto p-4">
        {loading && (
          <div className="text-center text-theme-gray4 py-8">
            搜索中...
          </div>
        )}

        {!loading && query && (!results || Object.keys(results).length === 0) && (
          <div className="text-center text-theme-gray4 py-8">
            未找到匹配的文件
          </div>
        )}

        {!loading && !query && (
          <div className="text-center text-theme-gray4 py-8">
            输入关键词开始搜索
          </div>
        )}

        {!loading && results && Object.keys(results).length > 0 && (
          <div className="space-y-4">
            {Object.entries(results).map(([filePath, result]) => (
              <div
                key={filePath}
                onClick={() => handleResultClick(filePath)}
                className="rounded-lg border border-theme-gray3 hover:border-theme-green hover:bg-theme-gray2 cursor-pointer transition-all"
              >
                {/* 文件路径标题 */}
                <div className="p-3 border-b border-theme-gray3">
                  <div
                    className="text-theme-white font-medium"
                    dangerouslySetInnerHTML={{
                      __html: highlightText(result.path, query)
                    }}
                  />
                </div>
                
                {/* 内容列表 */}
                {result.content && result.content.length > 0 && (
                  <div className="p-3 space-y-2">
                    {result.content.map((content, index) => (
                      <div
                        key={index}
                        className="text-theme-gray3 text-sm"
                        dangerouslySetInnerHTML={{
                          __html: highlightText(content, query)
                        }}
                      />
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 底部统计信息 */}
      {!loading && results && Object.keys(results).length > 0 && (
        <div className="h-[40px] bg-theme-black border-t border-theme-gray3 flex items-center px-4 text-theme-gray4 text-sm">
          找到 {Object.keys(results).length} 个文件
        </div>
      )}
    </div>
  );
};

export default SearchPanel;
