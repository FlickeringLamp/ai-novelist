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

export interface KnowledgeState {
  knowledgeBases: { [key: string]: KnowledgeBase };
  selectedKnowledgeBaseId: string | null;
  fileRefreshTrigger: number;
}

const initialState: KnowledgeState = {
  knowledgeBases: {},
  selectedKnowledgeBaseId: null,
  fileRefreshTrigger: 0,
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
  },
});

export const {
  setKnowledgeBases,
  setSelectedKnowledgeBaseId,
  incrementFileRefreshTrigger,
} = knowledgeSlice.actions;

export default knowledgeSlice.reducer;
