import { createSlice, type Draft, type PayloadAction } from '@reduxjs/toolkit';
import type { updater } from '../../wailsjs/go/models';

export interface LauncherState {
  logs: string[];
  version: string;
  updateStatus: updater.UpdateStatus | null;
  updating: boolean;
  progress: number;
  copied: boolean;
  mainRunning: boolean;
  launching: boolean;
  launchPhase: string;
  mirror: string;
}

const initialState: LauncherState = {
  logs: [],
  version: '',
  updateStatus: null,
  updating: false,
  progress: 0,
  copied: false,
  mainRunning: false,
  launching: false,
  launchPhase: '',
  mirror: 'tsinghua',
};

export const launcherSlice = createSlice({
  name: 'launcherSlice',
  initialState,
  reducers: {
    addLog: (state: Draft<LauncherState>, action: PayloadAction<string>) => {
      state.logs.push(action.payload);
    },
    setLogs: (state: Draft<LauncherState>, action: PayloadAction<string[]>) => {
      state.logs = action.payload;
    },
    setVersion: (state: Draft<LauncherState>, action: PayloadAction<string>) => {
      state.version = action.payload;
    },
    setUpdateStatus: (state: Draft<LauncherState>, action: PayloadAction<updater.UpdateStatus | null>) => {
      state.updateStatus = action.payload;
    },
    setUpdating: (state: Draft<LauncherState>, action: PayloadAction<boolean>) => {
      state.updating = action.payload;
    },
    setProgress: (state: Draft<LauncherState>, action: PayloadAction<number>) => {
      state.progress = action.payload;
    },
    setCopied: (state: Draft<LauncherState>, action: PayloadAction<boolean>) => {
      state.copied = action.payload;
    },
    setMainRunning: (state: Draft<LauncherState>, action: PayloadAction<boolean>) => {
      state.mainRunning = action.payload;
    },
    setLaunching: (state: Draft<LauncherState>, action: PayloadAction<boolean>) => {
      state.launching = action.payload;
    },
    setLaunchPhase: (state: Draft<LauncherState>, action: PayloadAction<string>) => {
      state.launchPhase = action.payload;
    },
    setMirror: (state: Draft<LauncherState>, action: PayloadAction<string>) => {
      state.mirror = action.payload;
    },
    resetProgress: (state: Draft<LauncherState>) => {
      state.progress = 0;
    },
  },
});

export const {
  addLog,
  setLogs,
  setVersion,
  setUpdateStatus,
  setUpdating,
  setProgress,
  setCopied,
  setMainRunning,
  setLaunching,
  setLaunchPhase,
  setMirror,
  resetProgress,
} = launcherSlice.actions;

export default launcherSlice.reducer;
