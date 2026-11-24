import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { apiClient, getApiErrorMessage } from "../../api/apiClient";
import { fetchAllPages } from "../../api/apiResources";

const rejectRequest = (error, rejectWithValue) =>
  rejectWithValue(getApiErrorMessage(error));

const toStockRow = (product) => ({
  ...product,
  ItemsName: product.name,
  QTY: product.stockQuantity,
  UnitPrice: product.unitPrice,
  SalingPrice: product.sellingPrice,
  TotalPrice: (Number(product.stockQuantity) * Number(product.unitPrice)).toFixed(2),
});

export const fetchTotalPurchase = createAsyncThunk(
  "totalPurchase/fetchTotalPurchase",
  async (_, { rejectWithValue }) => {
    try {
      return (await fetchAllPages("/products")).map(toStockRow);
    } catch (error) {
      return rejectRequest(error, rejectWithValue);
    }
  }
);

export const updatePurchaseItem = createAsyncThunk(
  "totalPurchase/updatePurchaseItem",
  async ({ id, updatedFields }, { getState, rejectWithValue }) => {
    try {
      const currentItem = getState().totalPurchase.items.find((item) => item.id === id);
      if (!currentItem) throw new Error("The stock item is no longer available. Reload the list.");
      const { data } = await apiClient.patch(`/products/${encodeURIComponent(id)}`, {
        ...(updatedFields.ItemsName !== undefined ? { name: updatedFields.ItemsName } : {}),
        ...(updatedFields.UnitPrice !== undefined ? { unitPrice: updatedFields.UnitPrice } : {}),
        ...(updatedFields.SalingPrice !== undefined ? { sellingPrice: updatedFields.SalingPrice } : {}),
      });
      const quantityDelta = updatedFields.QTY === undefined
        ? 0
        : Number(updatedFields.QTY) - Number(currentItem.QTY);
      let updatedProduct = data.product;
      if (quantityDelta !== 0) {
        const stockResponse = await apiClient.patch(`/products/${encodeURIComponent(id)}/stock`, {
          direction: quantityDelta > 0 ? "IN" : "OUT",
          quantity: String(Math.abs(quantityDelta)),
          reason: "Manual stock correction",
        });
        updatedProduct = stockResponse.data.product;
      }
      return { id, updatedFields: {
        ...updatedFields,
        ...toStockRow(updatedProduct),
      } };
    } catch (error) {
      return rejectRequest(error, rejectWithValue);
    }
  }
);

export const deletePurchaseItem = createAsyncThunk(
  "totalPurchase/deletePurchaseItem",
  async (id, { rejectWithValue }) => {
    try {
      await apiClient.delete(`/products/${encodeURIComponent(id)}`);
      return id;
    } catch (error) {
      return rejectRequest(error, rejectWithValue);
    }
  }
);

const totalPurchaseSlice = createSlice({
  name: "totalPurchase",
  initialState: { items: [], loading: false, error: null },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchTotalPurchase.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchTotalPurchase.fulfilled, (state, action) => {
        state.loading = false;
        state.items = action.payload;
      })
      .addCase(fetchTotalPurchase.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(updatePurchaseItem.fulfilled, (state, action) => {
        const index = state.items.findIndex((item) => item.id === action.payload.id);
        if (index !== -1) state.items[index] = { ...state.items[index], ...action.payload.updatedFields };
      })
      .addCase(updatePurchaseItem.rejected, (state, action) => {
        state.error = action.payload;
      })
      .addCase(deletePurchaseItem.fulfilled, (state, action) => {
        state.items = state.items.filter((item) => item.id !== action.payload);
      })
      .addCase(deletePurchaseItem.rejected, (state, action) => {
        state.error = action.payload;
      });
  },
});

export default totalPurchaseSlice.reducer;
