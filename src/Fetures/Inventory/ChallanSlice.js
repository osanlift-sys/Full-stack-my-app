import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { apiClient, getApiErrorMessage } from "../../api/apiClient";
import { fetchAllPages } from "../../api/apiResources";

const rejectRequest = (error, rejectWithValue) =>
  rejectWithValue(getApiErrorMessage(error));

const toUiChallan = (challan) => ({
  ...challan,
  toCompany: challan.companyName || "",
  date: challan.challanDate ? challan.challanDate.slice(0, 10) : "",
  items: (challan.items || []).map((item) => ({
    ...item,
    name: item.description,
  })),
});

export const fetchSavedChallans = createAsyncThunk(
  "challan/fetchSavedChallans",
  async (_, { rejectWithValue }) => {
    try {
      return (await fetchAllPages("/challans")).map(toUiChallan);
    } catch (error) {
      return rejectRequest(error, rejectWithValue);
    }
  }
);

export const fetchSavedChallanById = createAsyncThunk(
  "challan/fetchSavedChallanById",
  async (challanId, { rejectWithValue }) => {
    try {
      const { data } = await apiClient.get(`/challans/${encodeURIComponent(challanId)}`);
      return toUiChallan(data.challan);
    } catch (error) {
      return rejectRequest(error, rejectWithValue);
    }
  }
);

export const saveChallan = createAsyncThunk(
  "challan/saveChallan",
  async ({ challanData, documentId }, { rejectWithValue }) => {
    try {
      const payload = {
        challanNo: challanData.challanNo,
        companyName: challanData.toCompany || challanData.companyName,
        address: challanData.address,
        subject: challanData.subject,
        challanDate: /^\d{4}-\d{2}-\d{2}$/.test(challanData.date || "")
          ? challanData.date
          : undefined,
        items: (challanData.items || []).map((item) => ({
          description: item.description || item.name || item.itemName || "",
          quantity: item.quantity || 1,
          unit: item.unit || "Pcs",
        })),
      };
      const { data } = documentId
        ? await apiClient.patch(`/challans/${encodeURIComponent(documentId)}`, payload)
        : await apiClient.post("/challans", payload);
      return toUiChallan(data.challan);
    } catch (error) {
      return rejectRequest(error, rejectWithValue);
    }
  }
);

export const fetchAllCompanies = createAsyncThunk(
  "challan/fetchAllCompanies",
  async (_, { rejectWithValue }) => {
    try {
      const offers = await fetchAllPages("/offers");
      const companies = new Map();
      offers.forEach((offer) => {
        if (offer.companyId && offer.companyName) {
          companies.set(offer.companyId, {
            id: offer.companyId,
            displayName: offer.companyName,
          });
        }
      });
      return [...companies.values()].sort((a, b) => a.displayName.localeCompare(b.displayName));
    } catch (error) {
      return rejectRequest(error, rejectWithValue);
    }
  }
);

export const fetchOffersByCompany = createAsyncThunk(
  "challan/fetchOffersByCompany",
  async (companyId, { rejectWithValue }) => {
    try {
      if (!companyId) return [];
      return await fetchAllPages("/offers", { companyId });
    } catch (error) {
      return rejectRequest(error, rejectWithValue);
    }
  }
);

export const fetchSpecificOfferForChallan = createAsyncThunk(
  "challan/fetchSpecificOfferForChallan",
  async ({ offerId }, { rejectWithValue }) => {
    try {
      const { data } = await apiClient.get(`/offers/${encodeURIComponent(offerId)}`);
      const offer = data.offer;
      return {
        offerNo: offer.offerNo || offer.id,
        challanNo: offer.offerNo || offer.id,
        date: new Date().toISOString().slice(0, 10),
        toCompany: offer.companyName,
        address: offer.headerData?.address || "",
        subject: offer.subject ? `Delivery Challan for ${offer.subject}` : "Delivery Challan",
        items: (offer.items || []).map((item) => ({
          name: item.name || item.description || "",
          quantity: item.quantity || 1,
          unit: item.unit || "Pcs",
        })),
      };
    } catch (error) {
      return rejectRequest(error, rejectWithValue);
    }
  }
);

const generateUniqueChallanNo = () => {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const randomNum = Math.floor(1000 + Math.random() * 9000);
  return `CH-${dateStr}-${randomNum}`;
};

const challanSlice = createSlice({
  name: "challan",
  initialState: {
    companiesList: [],
    offersList: [],
    savedChallans: [],
    challanData: null,
    loadingCompanies: false,
    loadingOffers: false,
    loadingChallan: false,
    loadingSavedChallans: false,
    savingChallan: false,
    error: null,
  },
  reducers: {
    clearOffersList: (state) => {
      state.offersList = [];
      state.challanData = null;
    },
    createCustomChallan: (state, action) => {
      const customInfo = action.payload || {};
      state.challanData = {
        challanNo: generateUniqueChallanNo(),
        date: new Date().toISOString().slice(0, 10),
        toCompany: customInfo.toCompany || "Client / Company Name",
        address: customInfo.address || "Address Details",
        subject: customInfo.subject || "Delivery Challan",
        items: customInfo.items || [{ name: "Sample Item Name", quantity: 1, unit: "Pcs" }],
      };
    },
    resetChallan: (state) => {
      state.offersList = [];
      state.challanData = null;
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchAllCompanies.pending, (state) => {
        state.loadingCompanies = true;
        state.error = null;
      })
      .addCase(fetchAllCompanies.fulfilled, (state, action) => {
        state.loadingCompanies = false;
        state.companiesList = action.payload;
      })
      .addCase(fetchAllCompanies.rejected, (state, action) => {
        state.loadingCompanies = false;
        state.error = action.payload;
      })
      .addCase(fetchOffersByCompany.pending, (state) => {
        state.loadingOffers = true;
        state.error = null;
      })
      .addCase(fetchOffersByCompany.fulfilled, (state, action) => {
        state.loadingOffers = false;
        state.offersList = action.payload;
      })
      .addCase(fetchOffersByCompany.rejected, (state, action) => {
        state.loadingOffers = false;
        state.error = action.payload;
      })
      .addCase(fetchSavedChallans.pending, (state) => {
        state.loadingSavedChallans = true;
        state.error = null;
      })
      .addCase(fetchSavedChallans.fulfilled, (state, action) => {
        state.loadingSavedChallans = false;
        state.savedChallans = action.payload;
      })
      .addCase(fetchSavedChallans.rejected, (state, action) => {
        state.loadingSavedChallans = false;
        state.error = action.payload;
      })
      .addCase(fetchSavedChallanById.pending, (state) => {
        state.loadingChallan = true;
        state.error = null;
        state.challanData = null;
      })
      .addCase(fetchSavedChallanById.fulfilled, (state, action) => {
        state.loadingChallan = false;
        state.challanData = action.payload;
      })
      .addCase(fetchSavedChallanById.rejected, (state, action) => {
        state.loadingChallan = false;
        state.error = action.payload;
      })
      .addCase(saveChallan.pending, (state) => {
        state.savingChallan = true;
        state.error = null;
      })
      .addCase(saveChallan.fulfilled, (state, action) => {
        state.savingChallan = false;
        state.challanData = action.payload;
        state.savedChallans = [
          action.payload,
          ...state.savedChallans.filter((challan) => challan.id !== action.payload.id),
        ];
      })
      .addCase(saveChallan.rejected, (state, action) => {
        state.savingChallan = false;
        state.error = action.payload;
      })
      .addCase(fetchSpecificOfferForChallan.pending, (state) => {
        state.loadingChallan = true;
        state.error = null;
      })
      .addCase(fetchSpecificOfferForChallan.fulfilled, (state, action) => {
        state.loadingChallan = false;
        state.challanData = action.payload;
      })
      .addCase(fetchSpecificOfferForChallan.rejected, (state, action) => {
        state.loadingChallan = false;
        state.error = action.payload;
        state.challanData = null;
      });
  },
});

export const { clearOffersList, createCustomChallan, resetChallan } = challanSlice.actions;
export default challanSlice.reducer;
