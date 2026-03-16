import React from 'react';

interface FilePathAutocompleteProps {
  isOpen: boolean;
  paths: string[];
  selectedIndex: number;
  query: string;
  onSelect: (path: string) => void;
  onClose: () => void;
}

export const FilePathAutocomplete: React.FC<FilePathAutocompleteProps> = ({
  isOpen,
  paths,
  selectedIndex,
  query,
  onSelect,
  onClose
}) => {
  if (!isOpen || paths.length === 0) return null;

  // 高亮匹配的部分
  const highlightMatch = (path: string, query: string) => {
    if (!query) return path;
    
    const lowerPath = path.toLowerCase();
    const lowerQuery = query.toLowerCase();
    const index = lowerPath.indexOf(lowerQuery);
    
    if (index === -1) return path;
    
    const before = path.substring(0, index);
    const match = path.substring(index, index + query.length);
    const after = path.substring(index + query.length);
    
    return (
      <>
        {before}
        <span className="text-theme-green">{match}</span>
        {after}
      </>
    );
  };

  return (
    <div 
      className="absolute bottom-full left-0 mb-1 w-full max-h-[200px] overflow-y-auto bg-theme-gray1 border border-theme-gray3 rounded-small z-50 shadow-lg"
      onClick={(e) => e.stopPropagation()}
    >
      {paths.map((path, index) => (
        <div
          key={path}
          className={`px-3 py-2 cursor-pointer text-[13px] font-mono truncate transition-colors ${
            index === selectedIndex
              ? 'bg-theme-gray2 text-theme-white'
              : 'text-theme-gray5 hover:bg-theme-gray2'
          }`}
          onClick={() => onSelect(path)}
          onMouseEnter={() => {}}
        >
          {highlightMatch(path, query)}
        </div>
      ))}
    </div>
  );
};
