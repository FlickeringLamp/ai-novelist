import { createSlice, type Draft, type PayloadAction } from '@reduxjs/toolkit';

export interface KnowledgeBase {
  name: string;
  provider: string;
  model: string;
  chunkSize: number;
  overlapSize: number;
  similarity: number;
  returnDocs: number;
}

export interface FileState {
  current: number;
  total: number;
  percentage: number;
  message: string;
}

export interface KnowledgeState {
  knowledgeBases: { [key: string]: KnowledgeBase };
  selectedKnowledgeBaseId: string | null;
  fileRefreshTrigger: number;
  uploadProgress: { [knowledgeBaseId: string]: FileState | null };
  uploading: { [knowledgeBaseId: string]: boolean };
}

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
      action: PayloadAction<{ knowledgeBaseId: string; progress: FileState | null }>
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
