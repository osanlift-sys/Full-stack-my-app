import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { apiClient, getApiErrorMessage } from "../../api/apiClient";
import { fetchAllPages } from "../../api/apiResources";

const rejectRequest = (error, rejectWithValue) =>
  rejectWithValue(getApiErrorMessage(error));

export const fetchAllCompanies = createAsyncThunk(
  "invoice/fetchAllCompanies",
  async (_, { rejectWithValue }) => {
    try {
      const [offers, bills] = await Promise.all([
        fetchAllPages("/offers"),
        fetchAllPages("/bills"),
      ]);
      const companies = new Map();
      [...offers, ...bills].forEach((record) => {
        if (record.companyId && record.companyName) {
          companies.set(record.companyId, {
            id: record.companyId,
            displayName: record.companyName,
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
  "invoice/fetchOffersByCompany",
  async ({ companyId, filterMode = "all", subSourceFilter = "offers_only" }, { rejectWithValue }) => {
    try {
      const params = { companyId };
      const [offers, bills] = await Promise.all([
        filterMode === "general" ||
        (filterMode === "offer_based" && subSourceFilter === "bills_only")
          ? Promise.resolve([])
          : fetchAllPages("/offers", params),
        filterMode === "general"
          ? fetchAllPages("/bills", params)
          : filterMode === "offer_based" && subSourceFilter === "offers_only"
          ? Promise.resolve([])
          : fetchAllPages("/bills", params),
      ]);

      const offerRecords = offers.map((offer) => ({
        ...offer,
        sourceType: "offer",
        displayLabel: `Offer ${offer.offerNo} - ${offer.subject || "Offer"}`,
      }));
      const billRecords = bills
        .filter((bill) => filterMode !== "general" ||
          bill.createdType === "General" || bill.isBlankCreated)
        .filter((bill) => filterMode !== "offer_based" ||
          bill.createdType === "offer_based")
        .map((bill) => ({
          ...bill,
          sourceType: "bill",
          displayLabel: `Bill ${bill.billNo || bill.id} - ${bill.subject || "Saved bill"}`,
        }));

      return [...offerRecords, ...billRecords];
    } catch (error) {
      return rejectRequest(error, rejectWithValue);
    }
  }
);

export const fetchSpecificOfferFromDb = createAsyncThunk(
  "invoice/fetchSpecificOfferFromDb",
  async ({ offerId, sourceType }, { rejectWithValue }) => {
    try {
      const resource = sourceType === "bill" ? "bills" : "offers";
      const { data } = await apiClient.get(`/${resource}/${encodeURIComponent(offerId)}`);
      return sourceType === "bill"
        ? { ...data.bill, sourceType: "bill" }
        : { ...data.offer, sourceType: "offer" };
    } catch (error) {
      return rejectRequest(error, rejectWithValue);
    }
  }
);

export const saveBill = createAsyncThunk(
  "invoice/saveBill",
  async (billData, { rejectWithValue }) => {
    try {
      const { data } = await apiClient.post("/bills", billData);
      return { billId: data.bill.id, salesId: data.bill.id, billData: data.bill };
    } catch (error) {
      return rejectRequest(error, rejectWithValue);
    }
  }
);

export const updateBill = createAsyncThunk(
  "invoice/updateBill",
  async ({ billId, billData }, { rejectWithValue }) => {
    try {
      const { data } = await apiClient.patch(`/bills/${encodeURIComponent(billId)}`, billData);
      return { billId, salesId: billId, billData: data.bill };
    } catch (error) {
      return rejectRequest(error, rejectWithValue);
    }
  }
);

export const voidBill = createAsyncThunk(
  "invoice/voidBill",
  async (billId, { rejectWithValue }) => {
    try {
      await apiClient.delete(`/bills/${encodeURIComponent(billId)}`);
      return billId;
    } catch (error) {
      return rejectRequest(error, rejectWithValue);
    }
  }
);

const invoiceSlice = createSlice({
  name: "invoice",
  initialState: {
    companiesList: [],
    offersList: [],
    challanData: null,
    filterMode: "all",
    subSourceFilter: "offers_only",
    savedBillIds: null,
    loadingCompanies: false,
    loadingOffers: false,
    loadingChallan: false,
    savingBill: false,
    updatingBill: false,
    deletingBill: false,
    saveSuccess: false,
    updateSuccess: false,
    deleteSuccess: false,
    error: null,
  },
  reducers: {
    setFilterMode: (state, action) => {
      state.filterMode = action.payload;
    },
    setSubSourceFilter: (state, action) => {
      state.subSourceFilter = action.payload;
    },
    resetInvoiceData: (state) => {
      state.challanData = null;
      state.savedBillIds = null;
      state.error = null;
    },
    resetSaveStatus: (state) => {
      state.saveSuccess = false;
      state.updateSuccess = false;
      state.deleteSuccess = false;
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
        state.offersList = [];
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
      .addCase(fetchSpecificOfferFromDb.pending, (state) => {
        state.loadingChallan = true;
        state.error = null;
      })
      .addCase(fetchSpecificOfferFromDb.fulfilled, (state, action) => {
        state.loadingChallan = false;
        state.challanData = action.payload;
      })
      .addCase(fetchSpecificOfferFromDb.rejected, (state, action) => {
        state.loadingChallan = false;
        state.error = action.payload;
      })
      .addCase(saveBill.pending, (state) => {
        state.savingBill = true;
        state.saveSuccess = false;
      })
      .addCase(saveBill.fulfilled, (state, action) => {
        state.savingBill = false;
        state.saveSuccess = true;
        state.savedBillIds = { billId: action.payload.billId, salesId: action.payload.salesId };
      })
      .addCase(saveBill.rejected, (state, action) => {
        state.savingBill = false;
        state.error = action.payload;
      })
      .addCase(updateBill.pending, (state) => {
        state.updatingBill = true;
        state.updateSuccess = false;
      })
      .addCase(updateBill.fulfilled, (state) => {
        state.updatingBill = false;
        state.updateSuccess = true;
      })
      .addCase(updateBill.rejected, (state, action) => {
        state.updatingBill = false;
        state.error = action.payload;
      })
      .addCase(voidBill.pending, (state) => {
        state.deletingBill = true;
        state.deleteSuccess = false;
      })
      .addCase(voidBill.fulfilled, (state, action) => {
        state.deletingBill = false;
        state.deleteSuccess = true;
        state.challanData = null;
        state.savedBillIds = null;
        state.offersList = state.offersList.filter((item) => item.id !== action.payload);
      })
      .addCase(voidBill.rejected, (state, action) => {
        state.deletingBill = false;
        state.error = action.payload;
      });
  },
});

export const {
  setFilterMode,
  setSubSourceFilter,
  resetInvoiceData,
  resetSaveStatus,
} = invoiceSlice.actions;
export default invoiceSlice.reducer;
