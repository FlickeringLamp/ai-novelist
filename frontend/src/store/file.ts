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
  },
});

export const { toggleCollapse, collapseAll, setChapters } = fileSlice.actions;
export default fileSlice.reducer;
