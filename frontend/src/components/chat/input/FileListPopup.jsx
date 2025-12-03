import React, { useState, useEffect, useRef } from 'react';
import './FileListPopup.css';
import fileService from '../../../services/fileService.js';

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
        // 使用fileService获取文件列表
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
    <div className="file-list-popup">
      <input
        ref={inputRef}
        type="text"
        placeholder="搜索文件..."
        value={localSearchQuery}
        onChange={handleSearchChange}
        onKeyDown={handleKeyDown}
      />
      
      {loading ? (
        <div className="file-list-loading">加载中...</div>
      ) : filteredFiles.length === 0 ? (
        <div className="file-list-empty">没有找到文件</div>
      ) : (
        filteredFiles.map((file, index) => {
          return (
            <div
              key={file}
              className={`file-list-item ${index === selectedIndex ? 'selected' : ''}`}
              onClick={() => handleSelectFile(file)}
            >
              {file}
            </div>
          );
        })
      )}
    </div>
  );
};

export default FileListPopup;