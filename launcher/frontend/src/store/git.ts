import { createSlice, type Draft, type PayloadAction } from '@reduxjs/toolkit';

export interface CommitDetail {
  sha: string;
  message: string;
  date: string;
  author: string;
  parents: string[];
  is_head: boolean;
}

export interface BranchInfo {
  name: string;
  is_remote: boolean;
  is_current: boolean;
  sha: string;
}

export interface GitState {
  commits: CommitDetail[];
  branches: BranchInfo[];
  selectedCommit: CommitDetail | null;
  currentBranch: string;
  loading: boolean;
  checkoutLoading: boolean;
}

const initialState: GitState = {
  commits: [],
  branches: [],
  selectedCommit: null,
  currentBranch: '',
  loading: false,
  checkoutLoading: false,
};

export const gitSlice = createSlice({
  name: 'gitSlice',
  initialState,
  reducers: {
    setCommits: (state: Draft<GitState>, action: PayloadAction<CommitDetail[]>) => {
      state.commits = action.payload;
    },
    setBranches: (state: Draft<GitState>, action: PayloadAction<BranchInfo[]>) => {
      state.branches = action.payload;
      const curr = action.payload.find(b => b.is_current && !b.is_remote);
      if (curr) state.currentBranch = curr.name;
    },
    setSelectedCommit: (state: Draft<GitState>, action: PayloadAction<CommitDetail | null>) => {
      state.selectedCommit = action.payload;
    },
    setGitLoading: (state: Draft<GitState>, action: PayloadAction<boolean>) => {
      state.loading = action.payload;
    },
    setCheckoutLoading: (state: Draft<GitState>, action: PayloadAction<boolean>) => {
      state.checkoutLoading = action.payload;
    },
  },
});

export const {
  setCommits,
  setBranches,
  setSelectedCommit,
  setGitLoading,
  setCheckoutLoading,
} = gitSlice.actions;

export default gitSlice.reducer;
