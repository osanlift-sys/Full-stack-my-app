
import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { getApiErrorMessage } from '../../api/apiClient';
import { fetchAllPages } from '../../api/apiResources';

// ফায়ারবেসের 'salesList' (collection group) থেকে সমস্ত সেলস ডাটা ফেচ করার থাঙ্ক
export const fetchAllSalesData = createAsyncThunk(
  'bill/fetchAllSalesData',
  async (_, { rejectWithValue }) => {
    try {
      return await fetchAllPages('/bills');
    } catch (error) {
      return rejectWithValue(getApiErrorMessage(error));
    }
  }
);

const salesSlice = createSlice({
  name: 'sales',
  initialState: {
    salesList: [],
    loading: false,
    error: null,
  },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchAllSalesData.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchAllSalesData.fulfilled, (state, action) => {
        state.loading = false;
        state.salesList = action.payload; // ডাটা স্টোরে সেভ হচ্ছে
      })
      .addCase(fetchAllSalesData.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });
  },
});

export default salesSlice.reducer;