import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { getApiErrorMessage } from '../../api/apiClient';
import { fetchAllPages } from '../../api/apiResources';

export const fetchInstallationProjects = createAsyncThunk(
  'installationProjects/fetchInstallationProjects',
  async (_, { rejectWithValue }) => {
    try {
      return await fetchAllPages('/projects');
    } catch (error) {
      return rejectWithValue(getApiErrorMessage(error));
    }
  }
);

const installationProjectsSlice = createSlice({
  name: 'installationProjects',
  initialState: {
    projects: [],
    loading: false,
    error: null,
  },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchInstallationProjects.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchInstallationProjects.fulfilled, (state, action) => {
        state.projects = action.payload;
        state.loading = false;
      })
      .addCase(fetchInstallationProjects.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Could not load installation projects.';
      });
  },
});

export default installationProjectsSlice.reducer;
