import { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFile, faFolder, faSearch, faPlus } from '@fortawesome/free-solid-svg-icons';
import httpClient from '../../utils/httpClient.ts';

interface FileItem {
  id: string;
  title: string;
  isFolder: boolean;
  children?: FileItem[];
}

interface ApiResponse {
  success: boolean;
  data?: FileItem[];
  error?: string;
}

interface FileSelectorProps {
  onFileContentAdd: (response: any) => void;
}

const FileSelector = ({ onFileContentAdd }: FileSelectorProps) => {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [filteredFiles, setFilteredFiles] = useState<FileItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({});

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

    const filterFiles = (items: FileItem[], path = ''): FileItem[] => {
      const filtered = [];
      
      for (const item of items) {
        const itemPath = path ? `${path}/${item.title}` : item.title;
        
        // 如果是文件夹且名称匹配，则保留整个文件夹
        if (item.isFolder && item.title.toLowerCase().includes(searchTerm.toLowerCase())) {
          filtered.push(item);
        } 
        // 如果是文件夹，递归检查子项
        else if (item.isFolder && item.children) {
          const filteredChildren: FileItem[] = filterFiles(item.children, itemPath);
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
  const toggleFolder = (folderId: string) => {
    setExpandedFolders(prev => ({
      ...prev,
      [folderId]: !prev[folderId]
    }));
  };

  // 处理文件点击
  const handleFileClick = async (file: FileItem) => {
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
  const renderFileTree = (items: FileItem[], level = 0) => {
    return items.map(item => (
      <div key={item.id} style={{ paddingLeft: `${level * 20}px` }}>
        <div
          className={`flex items-center gap-2 p-2 cursor-pointer transition-all ${item.isFolder ? 'hover:bg-theme-gray1' : 'hover:bg-theme-gray1'}`}
          onClick={() => handleFileClick(item)}
        >
          {item.isFolder && (
            <FontAwesomeIcon
              icon={expandedFolders[item.id] ? faFolder : faFolder}
              className="text-theme-white text-[12px]"
            />
          )}
          {!item.isFolder && (
            <FontAwesomeIcon icon={faFile} className="text-theme-white text-[12px]" />
          )}
          <span className="text-theme-white text-[12px]">{item.title}</span>
        </div>
        {item.isFolder && item.children && expandedFolders[item.id] && (
          <div>
            {renderFileTree(item.children, level + 1)}
          </div>
        )}
      </div>
    ));
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h4 className="text-theme-white text-[12px] font-medium">选择文件</h4>
        <button className="flex items-center justify-center w-6 h-6 bg-transparent border-none text-theme-white cursor-pointer text-[12px] hover:text-theme-green transition-colors" onClick={fetchFiles} title="刷新文件列表">
          <FontAwesomeIcon icon={faSearch} />
        </button>
      </div>
      
      <div className="flex">
        <div className="relative flex-1">
          <FontAwesomeIcon icon={faSearch} className="absolute left-2 top-1/2 transform -translate-y-1/2 text-theme-white text-[12px]" />
          <input
            type="text"
            placeholder="搜索文件..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-8 pr-2 py-2 bg-transparent border border-theme-gray1 rounded-small text-theme-white text-[12px] outline-none placeholder:text-theme-white"
          />
        </div>
      </div>

      <div className="max-h-[200px] overflow-y-auto border border-theme-gray1 rounded-small">
        {isLoading ? (
          <div className="flex items-center justify-center p-4 text-theme-white text-[12px]">加载中...</div>
        ) : filteredFiles.length === 0 ? (
          <div className="flex items-center justify-center p-4 text-theme-white text-[12px]">没有找到文件</div>
        ) : (
          renderFileTree(filteredFiles)
        )}
      </div>
    </div>
  );
};

export default FileSelector;
