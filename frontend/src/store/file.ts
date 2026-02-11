import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

export interface ChapterItem {
  id: string;
  title?: string;
  isFolder?: boolean;
  type?: string;
  children?: ChapterItem[];
}

export interface FileState {
  collapsedChapters: Record<string, boolean>;
  chapters: ChapterItem[];
}

const fileState: FileState = {
  collapsedChapters: {}, // 管理文件夹展开/折叠状态，不存在或false应该为关闭
  chapters: [], // 文件树数据
};

export const fileSlice = createSlice({
  name: "fileSlice",
  initialState: fileState,
  reducers: {
    toggleCollapse: (state: FileState, action: PayloadAction<string>) => {
      const itemId = action.payload;
      state.collapsedChapters[itemId] = !state.collapsedChapters[itemId];
    },
    collapseAll: (state: FileState) => {
      state.collapsedChapters = {};
    },
    setChapters: (state: FileState, action: PayloadAction<ChapterItem[]>) => {
      state.chapters = action.payload;
    },
    // 临时添加文件/文件夹（用于write_file工具调用时临时显示）
    addTempFile: (state: FileState, action: PayloadAction<{ path: string }>) => {
      const { path } = action.payload;
      const parts = path.split('/');
      
      // 递归查找或创建文件夹
      const findOrCreateFolder = (items: ChapterItem[], partIndex: number): ChapterItem[] => {
        if (partIndex >= parts.length - 1) {
          // 最后一个部分是文件
          const fileName = parts[parts.length - 1] || 'file';
          // 检查文件是否已存在
          const existingFile = items.find(item => item.id === path);
          if (!existingFile) {
            items.push({
              id: path,
              title: fileName,
              isFolder: false,
              type: 'file',
            });
          }
          return items;
        }
        
        const folderName = parts[partIndex] || 'folder';
        const folderPath = parts.slice(0, partIndex + 1).join('/');
        let folder = items.find(item => item.id === folderPath);
        
        if (!folder) {
          folder = {
            id: folderPath,
            title: folderName,
            isFolder: true,
            children: [],
          };
          items.push(folder);
        }
        
        if (folder && folder.children) {
          findOrCreateFolder(folder.children, partIndex + 1);
        }
        
        return items;
      };
      
      findOrCreateFolder(state.chapters, 0);
    },
  },
});

export const { toggleCollapse, collapseAll, setChapters, addTempFile } = fileSlice.actions;
export default fileSlice.reducer;
