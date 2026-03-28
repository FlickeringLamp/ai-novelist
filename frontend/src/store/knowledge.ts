import { createSlice, type Draft, type PayloadAction } from '@reduxjs/toolkit';
import type { KnowledgeBase, KnowledgeState, UploadFileState } from '../types/store';

// KnowledgeBase, KnowledgeState, UploadFileState 类型定义已迁移到 types/store.ts
// 注意：原 FileState 已重命名为 UploadFileState 以避免与 file.ts 中的 FileState 冲突

const initialState: KnowledgeState = {
  knowledgeBases: {},
  selectedKnowledgeBaseId: null,
  fileRefreshTrigger: 0,
  uploadProgress: {},
  uploading: {},
};

export const knowledgeSlice = createSlice({
  name: 'knowledgeSlice',
  initialState,
  reducers: {
    setKnowledgeBases: (
      state: Draft<KnowledgeState>,
      action: PayloadAction<{ [key: string]: KnowledgeBase }>
    ) => {
      state.knowledgeBases = action.payload;
    },
    setSelectedKnowledgeBaseId: (
      state: Draft<KnowledgeState>,
      action: PayloadAction<string | null>
    ) => {
      state.selectedKnowledgeBaseId = action.payload;
    },
    incrementFileRefreshTrigger: (state: Draft<KnowledgeState>) => {
      state.fileRefreshTrigger += 1;
    },
    setUploadProgress: (
      state: Draft<KnowledgeState>,
      action: PayloadAction<{ knowledgeBaseId: string; progress: UploadFileState | null }>
    ) => {
      state.uploadProgress[action.payload.knowledgeBaseId] = action.payload.progress;
    },
    setUploading: (
      state: Draft<KnowledgeState>,
      action: PayloadAction<{ knowledgeBaseId: string; uploading: boolean }>
    ) => {
      state.uploading[action.payload.knowledgeBaseId] = action.payload.uploading;
    },
    resetUploadState: (
      state: Draft<KnowledgeState>,
      action: PayloadAction<string>
    ) => {
      state.uploadProgress[action.payload] = null;
      state.uploading[action.payload] = false;
    },
  },
});

export const {
  setKnowledgeBases,
  setSelectedKnowledgeBaseId,
  incrementFileRefreshTrigger,
  setUploadProgress,
  setUploading,
  resetUploadState,
} = knowledgeSlice.actions;

export default knowledgeSlice.reducer;
