import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { apiClient, getApiErrorMessage } from "../../api/apiClient";
import { fetchAllPages } from "../../api/apiResources";

const rejectRequest = (error, rejectWithValue) =>
  rejectWithValue(getApiErrorMessage(error));

export const fetchAllSavedOffers = createAsyncThunk(
  "offer/fetchAllSavedOffers",
  async (_, { rejectWithValue }) => {
    try {
      return await fetchAllPages("/offers");
    } catch (error) {
      return rejectRequest(error, rejectWithValue);
    }
  }
);

export const fetchOfferProducts = createAsyncThunk(
  "offer/fetchOfferProducts",
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await apiClient.get("/offers/products");
      return data.items;
    } catch (error) {
      return rejectRequest(error, rejectWithValue);
    }
  }
);

export const fetchPurchaseProducts = createAsyncThunk(
  "offer/fetchPurchaseProducts",
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await apiClient.get("/offers/purchase-products");
      return data.items;
    } catch (error) {
      return rejectRequest(error, rejectWithValue);
    }
  }
);

export const saveOffer = createAsyncThunk(
  "offer/saveOffer",
  async (offerData, { rejectWithValue }) => {
    try {
      const { data } = await apiClient.post("/offers", offerData);
      return data.offer;
    } catch (error) {
      return rejectRequest(error, rejectWithValue);
    }
  }
);

export const updateOffer = createAsyncThunk(
  "offer/updateOffer",
  async ({ offerId, offerPayload }, { rejectWithValue }) => {
    try {
      const { data } = await apiClient.patch(`/offers/${encodeURIComponent(offerId)}`, offerPayload);
      return data.offer;
    } catch (error) {
      return rejectRequest(error, rejectWithValue);
    }
  }
);

export const deleteOffer = createAsyncThunk(
  "offer/deleteOffer",
  async (offerId, { rejectWithValue }) => {
    try {
      await apiClient.delete(`/offers/${encodeURIComponent(offerId)}`);
      return offerId;
    } catch (error) {
      return rejectRequest(error, rejectWithValue);
    }
  }
);

const offerSlice = createSlice({
  name: "offer",
  initialState: {
    offerList: [],
    purchaseList: [],
    purchaseLoading: false,
    purchaseError: null,
    allSavedOffers: [],
    loading: false,
    isUpdating: false,
    isDeleting: false,
    savedOfferInfo: null,
    currentOfferData: null,
    error: null,
    successMessage: null,
  },
  reducers: {
    clearOfferStatus: (state) => {
      state.loading = false;
      state.isUpdating = false;
      state.isDeleting = false;
      state.error = null;
      state.successMessage = null;
    },
    setSavedOfferInfo: (state, action) => {
      state.savedOfferInfo = action.payload;
    },
    setCurrentOfferData: (state, action) => {
      state.currentOfferData = action.payload;
    },
    resetFormState: (state) => {
      state.savedOfferInfo = null;
      state.currentOfferData = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchAllSavedOffers.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchAllSavedOffers.fulfilled, (state, action) => {
        state.loading = false;
        state.allSavedOffers = action.payload;
      })
      .addCase(fetchAllSavedOffers.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(saveOffer.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(saveOffer.fulfilled, (state, action) => {
        state.loading = false;
        state.savedOfferInfo = {
          companyId: action.payload.companyId,
          id: action.payload.id,
          offerNo: action.payload.offerNo,
        };
        state.allSavedOffers.unshift(action.payload);
      })
      .addCase(saveOffer.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(updateOffer.pending, (state) => {
        state.isUpdating = true;
        state.error = null;
      })
      .addCase(updateOffer.fulfilled, (state, action) => {
        state.isUpdating = false;
        const index = state.allSavedOffers.findIndex((item) => item.id === action.payload.id);
        if (index !== -1) state.allSavedOffers[index] = action.payload;
      })
      .addCase(updateOffer.rejected, (state, action) => {
        state.isUpdating = false;
        state.error = action.payload;
      })
      .addCase(deleteOffer.pending, (state) => {
        state.isDeleting = true;
        state.error = null;
      })
      .addCase(deleteOffer.fulfilled, (state, action) => {
        state.isDeleting = false;
        state.savedOfferInfo = null;
        state.currentOfferData = null;
        state.allSavedOffers = state.allSavedOffers.filter((item) => item.id !== action.payload);
      })
      .addCase(deleteOffer.rejected, (state, action) => {
        state.isDeleting = false;
        state.error = action.payload;
      })
      .addCase(fetchOfferProducts.fulfilled, (state, action) => {
        state.offerList = action.payload;
      })
      .addCase(fetchPurchaseProducts.pending, (state) => {
        state.purchaseLoading = true;
        state.purchaseError = null;
      })
      .addCase(fetchPurchaseProducts.fulfilled, (state, action) => {
        state.purchaseLoading = false;
        state.purchaseList = action.payload;
      })
      .addCase(fetchPurchaseProducts.rejected, (state, action) => {
        state.purchaseLoading = false;
        state.purchaseError = action.payload;
      });
  },
});

export const { clearOfferStatus, setSavedOfferInfo, setCurrentOfferData, resetFormState } =
  offerSlice.actions;
export default offerSlice.reducer;
