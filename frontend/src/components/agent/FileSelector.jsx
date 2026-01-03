import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFile, faFolder, faSearch, faPlus } from '@fortawesome/free-solid-svg-icons';
import httpClient from '../../utils/httpClient.js';
import './FileSelector.css';

const FileSelector = ({ onFileContentAdd }) => {
  const [files, setFiles] = useState([]);
  const [filteredFiles, setFilteredFiles] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [expandedFolders, setExpandedFolders] = useState({});

  // 获取文件列表
  // 获取文件列表
  const fetchFiles = async () => {
    setIsLoading(true);
    try {
      const result = await httpClient.get('/api/file/tree');
      if (result.success) {
        setFiles(result.data || []);
        setFilteredFiles(result.data || []);
      } else {
        console.error('获取文件列表失败:', result.error);
      }
    } catch (error) {
      console.error('获取文件列表出错:', error);
    } finally {
      setIsLoading(false);
    }
  };
  useEffect(() => {
    fetchFiles();
  }, []);

  // 搜索和过滤文件
  useEffect(() => {
    if (!searchTerm.trim()) {
      setFilteredFiles(files);
      return;
    }

    const filterFiles = (items, path = '') => {
      const filtered = [];
      
      for (const item of items) {
        const itemPath = path ? `${path}/${item.title}` : item.title;
        
        // 如果是文件夹且名称匹配，则保留整个文件夹
        if (item.isFolder && item.title.toLowerCase().includes(searchTerm.toLowerCase())) {
          filtered.push(item);
        } 
        // 如果是文件夹，递归检查子项
        else if (item.isFolder && item.children) {
          const filteredChildren = filterFiles(item.children, itemPath);
          if (filteredChildren.length > 0) {
            filtered.push({
              ...item,
              children: filteredChildren
            });
          }
        } 
        // 如果是文件且名称匹配，则保留
        else if (!item.isFolder && item.title.toLowerCase().includes(searchTerm.toLowerCase())) {
          filtered.push(item);
        }
      }
      
      return filtered;
    };

    setFilteredFiles(filterFiles(files));
  }, [searchTerm, files]);

  // 切换文件夹展开/折叠状态
  const toggleFolder = (folderId) => {
    setExpandedFolders(prev => ({
      ...prev,
      [folderId]: !prev[folderId]
    }));
  };

  // 处理文件点击
  const handleFileClick = async (file) => {
    if (file.isFolder) {
      toggleFolder(file.id);
      return;
    }
    try {
      const response = await httpClient.get(`/api/file/read/${encodeURIComponent(file.id)}`);
      onFileContentAdd(response);
    } catch (error) {
      console.error('读取文件内容出错:', error);
    }
  };

  // 渲染文件树
  const renderFileTree = (items, level = 0) => {
    return items.map(item => (
      <div key={item.id} className="file-item" style={{ paddingLeft: `${level * 20}px` }}>
        <div 
          className={`file-row ${item.isFolder ? 'folder' : 'file'}`}
          onClick={() => handleFileClick(item)}
        >
          {item.isFolder && (
            <FontAwesomeIcon 
              icon={expandedFolders[item.id] ? faFolder : faFolder} 
              className="folder-icon"
            />
          )}
          {!item.isFolder && (
            <FontAwesomeIcon icon={faFile} className="file-icon" />
          )}
          <span className="file-name">{item.title}</span>
        </div>
        {item.isFolder && item.children && expandedFolders[item.id] && (
          <div className="folder-children">
            {renderFileTree(item.children, level + 1)}
          </div>
        )}
      </div>
    ));
  };

  return (
    <div className="file-selector">
      <div className="file-selector-header">
        <h4>选择文件</h4>
        <button className="refresh-button" onClick={fetchFiles} title="刷新文件列表">
          <FontAwesomeIcon icon={faSearch} />
        </button>
      </div>
      
      <div className="search-container">
        <div className="search-input-wrapper">
          <FontAwesomeIcon icon={faSearch} className="search-icon" />
          <input
            type="text"
            placeholder="搜索文件..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
        </div>
      </div>

      <div className="file-list">
        {isLoading ? (
          <div className="loading">加载中...</div>
        ) : filteredFiles.length === 0 ? (
          <div className="no-files">没有找到文件</div>
        ) : (
          renderFileTree(filteredFiles)
        )}
      </div>
    </div>
  );
};

export default FileSelector;