import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { apiClient, getApiErrorMessage } from "../../api/apiClient";

async function findOrCreateProduct(item) {
  const name = String(item.ItemsName || "").trim();
  const { data } = await apiClient.get("/products", {
    params: { search: name, page: 1, limit: 100 },
  });
  const existing = data.items.find((product) => product.name.trim().toLowerCase() === name.toLowerCase());
  if (existing) {
    const unitPrice = String(item.UnitPrice || existing.unitPrice);
    const sellingPrice = String(item.SalingPrice || existing.sellingPrice);
    if (unitPrice !== existing.unitPrice || sellingPrice !== existing.sellingPrice) {
      const updated = await apiClient.patch(`/products/${encodeURIComponent(existing.id)}`, {
        unitPrice,
        sellingPrice,
      });
      return updated.data.product;
    }
    return existing;
  }

  const productResponse = await apiClient.post("/products", {
    name,
    unit: item.unit || "Pcs",
    unitPrice: String(item.UnitPrice || 0),
    sellingPrice: String(item.SalingPrice || 0),
    stockQuantity: "0",
  });
  return productResponse.data.product;
}

export const savePurchaseData = createAsyncThunk(
  "purchase/savePurchaseData",
  async ({ items, date }, { rejectWithValue }) => {
    try {
      if (!date) throw new Error("Purchase date is required.");
      const grouped = new Map();
      (items || []).forEach((item) => {
        const name = String(item.ItemsName || "").trim();
        const quantity = Number(item.QTY);
        if (!name || !Number.isFinite(quantity) || quantity <= 0) return;
        const key = name.toLowerCase();
        const previous = grouped.get(key);
        grouped.set(key, {
          ...item,
          ItemsName: name,
          QTY: String((Number(previous?.QTY) || 0) + quantity),
        });
      });
      if (!grouped.size) {
        throw new Error("Add at least one purchase item with a valid quantity.");
      }

      const productIds = [];
      for (const item of grouped.values()) {
        const product = await findOrCreateProduct(item);
        productIds.push({ productId: product.id, quantity: item.QTY });
      }

      const { data } = await apiClient.post("/purchases", { date, items: productIds });
      return data.purchase;
    } catch (error) {
      return rejectWithValue(getApiErrorMessage(error));
    }
  }
);

const purchaseSlice = createSlice({
  name: "purchase",
  initialState: { loading: false, error: null, successMessage: false },
  reducers: {
    clearStatus: (state) => {
      state.error = null;
      state.successMessage = false;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(savePurchaseData.pending, (state) => {
        state.loading = true;
        state.error = null;
        state.successMessage = false;
      })
      .addCase(savePurchaseData.fulfilled, (state) => {
        state.loading = false;
        state.successMessage = true;
      })
      .addCase(savePurchaseData.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });
  },
});

export const { clearStatus } = purchaseSlice.actions;
export default purchaseSlice.reducer;
