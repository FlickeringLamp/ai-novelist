import { useState, useCallback, useEffect, useRef } from 'react';
import httpClient from '../../../utils/httpClient';

interface UseFilePathAutocompleteReturn {
  isOpen: boolean;
  filteredPaths: string[];
  selectedIndex: number;
  query: string;
  cursorPosition: number;
  setCursorPosition: (pos: number) => void;
  handleInputChange: (value: string, cursorPos: number) => void;
  handleKeyDown: (e: React.KeyboardEvent) => boolean;
  selectPath: (path: string) => string;
  closeAutocomplete: () => void;
}

// 最大显示数量
const MAX_DISPLAY_ITEMS = 10;

export const useFilePathAutocomplete = (
  message: string,
  setMessage: (value: string) => void
): UseFilePathAutocompleteReturn => {
  const [isOpen, setIsOpen] = useState(false);
  const [allPaths, setAllPaths] = useState<string[]>([]);
  const [filteredPaths, setFilteredPaths] = useState<string[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [query, setQuery] = useState('');
  const [cursorPosition, setCursorPosition] = useState(0);
  const [atPosition, setAtPosition] = useState(-1);
  const isFetchingRef = useRef(false);
  const selectedIndexRef = useRef(0);

  // 同步selectedIndexRef
  useEffect(() => {
    selectedIndexRef.current = selectedIndex;
  }, [selectedIndex]);

  // 获取所有文件路径
  const fetchAllPaths = useCallback(async () => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    try {
      const paths = await httpClient.get('/api/file/all-paths') as string[];
      setAllPaths(paths);
    } catch (error) {
      console.error('获取文件路径失败:', error);
    } finally {
      isFetchingRef.current = false;
    }
  }, []);

  // 检测是否在@触发补全
  const checkForAtTrigger = useCallback((value: string, cursorPos: number) => {
    // 查找光标前最后一个@的位置
    const textBeforeCursor = value.substring(0, cursorPos);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');
    
    if (lastAtIndex === -1) {
      return null;
    }
    
    // 检查@后面是否包含空格或换行（如果是，则不触发补全）
    const textAfterAt = textBeforeCursor.substring(lastAtIndex + 1);
    if (textAfterAt.includes(' ') || textAfterAt.includes('\n')) {
      return null;
    }
    
    return {
      atIndex: lastAtIndex,
      query: textAfterAt.toLowerCase()
    };
  }, []);

  // 选中路径
  const selectPath = useCallback((path: string): string => {
    if (atPosition === -1) return message;
    
    const beforeAt = message.substring(0, atPosition);
    const afterQuery = message.substring(cursorPosition);
    
    const newMessage = `${beforeAt}@${path}${afterQuery}`;
    
    return newMessage;
  }, [message, atPosition, cursorPosition]);

  // 关闭补全
  const closeAutocomplete = useCallback(() => {
    setIsOpen(false);
    setAtPosition(-1);
    setQuery('');
  }, []);

  // 处理输入变化
  const handleInputChange = useCallback((value: string, cursorPos: number) => {
    setCursorPosition(cursorPos);
    
    const triggerInfo = checkForAtTrigger(value, cursorPos);
    
    if (triggerInfo) {
      setAtPosition(triggerInfo.atIndex);
      setQuery(triggerInfo.query);
      
      // 首次触发时获取文件列表
      if (!isOpen && allPaths.length === 0) {
        fetchAllPaths();
      }
      
      // 过滤路径
      const filtered = allPaths
        .filter(path => path.toLowerCase().includes(triggerInfo.query))
        .slice(0, MAX_DISPLAY_ITEMS);
      
      setFilteredPaths(filtered);
      setSelectedIndex(0);
      setIsOpen(filtered.length > 0);
    } else {
      setIsOpen(false);
      setAtPosition(-1);
      setQuery('');
    }
  }, [allPaths, isOpen, checkForAtTrigger, fetchAllPaths]);

  // 键盘事件处理
  const handleKeyDown = useCallback((e: React.KeyboardEvent): boolean => {
    if (!isOpen) return false;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => 
          prev < filteredPaths.length - 1 ? prev + 1 : prev
        );
        return true;
        
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => prev > 0 ? prev - 1 : 0);
        return true;
        
      case 'Enter':
        e.preventDefault();
        const currentIndex = selectedIndexRef.current;
        if (filteredPaths[currentIndex]) {
          const newMessage = selectPath(filteredPaths[currentIndex]);
          setMessage(newMessage);
          closeAutocomplete();
        }
        return true;
        
      case 'Escape':
        closeAutocomplete();
        return true;
        
      default:
        return false;
    }
  }, [isOpen, filteredPaths, selectPath, setMessage, closeAutocomplete]);

  // 当allPaths更新时，重新过滤
  useEffect(() => {
    if (isOpen && atPosition !== -1) {
      const filtered = allPaths
        .filter(path => path.toLowerCase().includes(query))
        .slice(0, MAX_DISPLAY_ITEMS);
      setFilteredPaths(filtered);
      setSelectedIndex(0);
    }
  }, [allPaths, isOpen, atPosition, query]);

  return {
    isOpen,
    filteredPaths,
    selectedIndex,
    query,
    cursorPosition,
    setCursorPosition,
    handleInputChange,
    handleKeyDown,
    selectPath,
    closeAutocomplete
  };
};
