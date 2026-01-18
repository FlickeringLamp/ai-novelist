import { useState, useEffect, useRef } from 'react';

const FileListPopup = ({ onSelectFile, onClose, searchQuery }) => {
  const [files, setFiles] = useState([]);
  const [filteredFiles, setFilteredFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [localSearchQuery, setLocalSearchQuery] = useState(searchQuery || '');
  const inputRef = useRef(null);

  // 获取文件列表
  useEffect(() => {
    const fetchFiles = async () => {
      setLoading(true);
      try {
        const response = await fetch('http://localhost:8000/api/file/list');
        const data = await response.json();
        
        if (data.success && data.files) {
          setFiles(data.files);
        }
      } catch (error) {
        console.error('获取文件列表失败:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchFiles();
  }, []);

  // 根据搜索查询过滤文件
  useEffect(() => {
    if (!localSearchQuery.trim()) {
      setFilteredFiles(files);
    } else {
      const filtered = files.filter(file => {
        return file.toLowerCase().includes(localSearchQuery.toLowerCase());
      });
      setFilteredFiles(filtered);
    }
    setSelectedIndex(0); // 重置选中索引
  }, [files, localSearchQuery]);

  // 自动聚焦到搜索输入框
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  // 处理键盘事件
  const handleKeyDown = (e) => {
    switch (e.key) {
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => Math.max(0, prev - 1));
        break;
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => Math.min(filteredFiles.length - 1, prev + 1));
        break;
      case 'Enter':
        e.preventDefault();
        if (filteredFiles.length > 0) {
          handleSelectFile(filteredFiles[selectedIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        onClose();
        break;
    }
  };

  // 选择文件
  const handleSelectFile = (file) => {
    onSelectFile(file);
  };

  // 处理搜索输入变化
  const handleSearchChange = (e) => {
    setLocalSearchQuery(e.target.value);
  };

  return (
    <div className="flex flex-col w-full max-h-[300px] bg-theme-black border border-theme-gray rounded-small shadow-deep overflow-hidden">
      <input
        ref={inputRef}
        type="text"
        placeholder="搜索文件..."
        value={localSearchQuery}
        onChange={handleSearchChange}
        onKeyDown={handleKeyDown}
        className="w-full p-2.5 p-2.5-[12px] bg-transparent border-none border-b border-theme-gray text-theme-white text-[14px] outline-none box-border placeholder:text-theme-gray"
      />
      
      {loading ? (
        <div className="flex items-center justify-center p-4 text-theme-gray text-[14px]">加载中...</div>
      ) : filteredFiles.length === 0 ? (
        <div className="flex items-center justify-center p-4 text-theme-gray text-[14px]">没有找到文件</div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          {filteredFiles.map((file, index) => {
            return (
              <div
                key={file}
                className={`p-2.5 p-2.5-[12px] cursor-pointer transition-all border-b border-theme-gray ${index === selectedIndex ? 'bg-theme-green/10 border-l-3 border-l-theme-green' : 'hover:bg-theme-gray'}`}
                onClick={() => handleSelectFile(file)}
              >
                {file}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default FileListPopup;