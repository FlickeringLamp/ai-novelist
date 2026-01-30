import { createSlice, type Draft, type PayloadAction } from '@reduxjs/toolkit';

export interface ProviderData {
  name: string;
  enable: boolean;
  url: string;
  key: string;
  favoriteModels: {
    chat: { [key: string]: any };
    embedding: { [key: string]: any };
    other: { [key: string]: any };
  };
}

export interface ProviderState {
  allProvidersData: { [key: string]: ProviderData };
  selectedProviderId: string | null;
}

const initialState: ProviderState = {
  allProvidersData: {},
  selectedProviderId: "openrouter",
};

export const providerSlice = createSlice({
  name: 'providerSlice',
  initialState,
  reducers: {
    setAllProvidersData: (
      state: Draft<ProviderState>,
      action: PayloadAction<{ [key: string]: ProviderData }>
    ) => {
      state.allProvidersData = action.payload;
    },
    setSelectedProviderId: (
      state: Draft<ProviderState>,
      action: PayloadAction<string | null>
    ) => {
      state.selectedProviderId = action.payload;
    }
  }
});

export const {
  setAllProvidersData,
  setSelectedProviderId,
} = providerSlice.actions;

export default providerSlice.reducer;
