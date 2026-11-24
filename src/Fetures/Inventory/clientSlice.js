import { createAsyncThunk, createSelector, createSlice } from '@reduxjs/toolkit';
import { getApiErrorMessage } from '../../api/apiClient';
import { fetchAllPages } from '../../api/apiResources';

const getOfferTotal = (offer) => {
  const storedTotal =
    offer.grandTotal ??
    offer.totalAmount ??
    offer.totalBill ??
    offer.offerTotal ??
    offer.total;

  if (storedTotal !== undefined && storedTotal !== null && storedTotal !== '') {
    return parseFloat(String(storedTotal).replace(/,/g, '')) || 0;
  }

  const items = Array.isArray(offer.items)
    ? offer.items
    : Array.isArray(offer.products)
      ? offer.products
      : [];

  return items.reduce((total, item) => {
    const quantity = Number(String(item.quantity ?? item.qty ?? 0).replace(/,/g, '')) || 0;
    const price = Number(String(item.price ?? item.unitPrice ?? item.rate ?? 0).replace(/,/g, '')) || 0;
    return total + quantity * price;
  }, 0);
};

const getMonthKey = (dateValue) => {
  if (!dateValue) return '';

  if (typeof dateValue === 'string') {
    const datePrefix = dateValue.match(/^(\d{4})-(\d{2})/);
    if (datePrefix) return `${datePrefix[1]}-${datePrefix[2]}`;
  }

  const date =
    typeof dateValue?.toDate === 'function'
      ? dateValue.toDate()
      : dateValue?.seconds
        ? new Date(dateValue.seconds * 1000)
        : new Date(dateValue);

  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
};

const buildClientsData = (offerList, salesList, filterMonth = '') => {
  const clientsMap = {};

  offerList.forEach((offer) => {
    const offerDate =
      offer.headerData?.date || offer.offerDate || offer.date || offer.createdAt;
    if (filterMonth && getMonthKey(offerDate) !== filterMonth) return;

    const rawName =
      offer.headerData?.toCompany ||
      offer.companyName ||
      offer.customerName ||
      'Unknown Client';
    const companyName = rawName.trim();
    const offerAmount = getOfferTotal(offer);

    if (!clientsMap[companyName]) {
      clientsMap[companyName] = {
        clientName: companyName,
        totalOffer: 0,
        totalBill: 0,
        totalReceived: 0,
        totalDue: 0,
      };
    }
    clientsMap[companyName].totalOffer += offerAmount;
  });

  salesList.forEach((sale) => {
    const saleDate = sale.billDate || sale.date || sale.createdAt;
    if (filterMonth && getMonthKey(saleDate) !== filterMonth) return;

    const rawName =
      sale.companyName ||
      sale.headerData?.toCompany ||
      sale.customerName ||
      'Unknown Client';
    const companyName = rawName.trim();
    const billAmount = Number(
      sale.grandTotal || sale.totalBill || sale.billAmount || 0
    );
    const rawReceived =
      sale.paidAmount ?? sale.receivedAmount ?? sale.totalReceived ?? 0;
    const receivedAmount =
      parseFloat(String(rawReceived).replace(/,/g, '')) || 0;

    if (!clientsMap[companyName]) {
      clientsMap[companyName] = {
        clientName: companyName,
        totalOffer: 0,
        totalBill: 0,
        totalReceived: 0,
        totalDue: 0,
      };
    }
    clientsMap[companyName].totalBill += billAmount;
    clientsMap[companyName].totalReceived += receivedAmount;
  });

  return Object.values(clientsMap).map((client) => {
    const due = client.totalBill - client.totalReceived;
    return {
      ...client,
      totalDue: due > 0 ? due : 0,
    };
  });
};

const filterClients = (clientsData, searchTerm, statusFilter) =>
  clientsData.filter((client) => {
    const matchesSearch = client.clientName
      .toLowerCase()
      .includes(searchTerm.toLowerCase());

    if (statusFilter === 'DUE') {
      return matchesSearch && client.totalDue > 0;
    }
    if (statusFilter === 'PAID') {
      return matchesSearch && client.totalDue <= 0 && client.totalBill > 0;
    }
    return matchesSearch;
  });

// ১. Firestore থেকে Offer Data Fetch করার Thunk
export const fetchOfferList = createAsyncThunk(
  'client/fetchOfferList',
  async (_, { rejectWithValue }) => {
    try {
      return await fetchAllPages('/offers');
    } catch (error) {
      return rejectWithValue(getApiErrorMessage(error));
    }
  }
);

// ২. Firestore থেকে Sales Data Fetch করার Thunk
export const fetchSalesList = createAsyncThunk(
  'client/fetchSalesList',
  async (_, { rejectWithValue }) => {
    try {
      return await fetchAllPages('/bills');
    } catch (error) {
      return rejectWithValue(getApiErrorMessage(error));
    }
  }
);

const initialState = {
  offerList: [],
  salesList: [],
  loading: false,
  error: null,
  searchTerm: '',
  statusFilter: 'ALL',
};

const clientSlice = createSlice({
  name: 'client',
  initialState,
  reducers: {
    setSearchTerm: (state, action) => {
      state.searchTerm = action.payload;
    },
    setStatusFilter: (state, action) => {
      state.statusFilter = action.payload;
    },
    resetFilters: (state) => {
      state.searchTerm = '';
      state.statusFilter = 'ALL';
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchOfferList.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchOfferList.fulfilled, (state, action) => {
        state.loading = false;
        state.offerList = action.payload;
      })
      .addCase(fetchOfferList.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(fetchSalesList.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchSalesList.fulfilled, (state, action) => {
        state.loading = false;
        state.salesList = action.payload;
      })
      .addCase(fetchSalesList.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });
  },
});

export const { setSearchTerm, setStatusFilter, resetFilters } = clientSlice.actions;

// Base Selectors
export const selectOfferList = (state) =>
  Array.isArray(state.client?.offerList) ? state.client.offerList : [];
export const selectSalesList = (state) =>
  Array.isArray(state.client?.salesList) ? state.client.salesList : [];
export const selectSearchTerm = (state) => state.client.searchTerm || '';
export const selectStatusFilter = (state) => state.client.statusFilter || 'ALL';

// Combined Client Data Selector
export const selectClientsData = createSelector(
  [selectOfferList, selectSalesList],
  (offerList, salesList) => buildClientsData(offerList, salesList)
);

// Filtered Clients Selector
export const selectFilteredClients = createSelector(
  [selectClientsData, selectSearchTerm, selectStatusFilter],
  filterClients
);

export const selectFilteredClientsByMonth = createSelector(
  [
    selectOfferList,
    selectSalesList,
    selectSearchTerm,
    selectStatusFilter,
    (_state, filterMonth) => filterMonth,
  ],
  (offerList, salesList, searchTerm, statusFilter, filterMonth) =>
    filterClients(
      buildClientsData(offerList, salesList, filterMonth),
      searchTerm,
      statusFilter
    )
);

// Summary Totals Selector
const calculateSummaryTotals = (filteredClients) =>
  filteredClients.reduce(
    (acc, client) => {
      acc.totalOffer += client.totalOffer;
      acc.totalBill += client.totalBill;
      acc.totalReceived += client.totalReceived;
      acc.totalDue += client.totalDue;
      return acc;
    },
    { totalOffer: 0, totalBill: 0, totalReceived: 0, totalDue: 0 }
  );

export const selectClientSummaryTotals = createSelector(
  [selectFilteredClients],
  calculateSummaryTotals
);

export const selectClientSummaryTotalsByMonth = createSelector(
  [selectFilteredClientsByMonth],
  calculateSummaryTotals
);

// Client Specific Ledger Selector
export const selectClientDetailsByName = (clientName) =>
  createSelector(
    [selectOfferList, selectSalesList],
    (offerList, salesList) => {
      if (!clientName) return null;

      const decodedName = decodeURIComponent(clientName).trim().toLowerCase();

      // Helper function to clean company names for flexible matching
      const cleanName = (str) =>
        (str || '').toString().trim().replace(/\./g, '').toLowerCase();

      const targetClean = cleanName(decodedName);

      // Offer Matching & Field Formatting
      const clientOffers = offerList
        .filter((offer) => {
          const name =
            offer.headerData?.toCompany ||
            offer.companyName ||
            offer.customerName ||
            '';
          return cleanName(name) === targetClean;
        })
        .map((offer) => ({
          ...offer,
          grandTotal: getOfferTotal(offer),
          offerDate:
            offer.headerData?.date ||
            offer.offerDate ||
            offer.date ||
            offer.createdAt ||
            'N/A',
        }));

      // Sales / Bill Matching & Field Formatting
      const clientSales = salesList
        .filter((sale) => {
          const name =
            sale.companyName ||
            sale.headerData?.toCompany ||
            sale.customerName ||
            '';
          return cleanName(name) === targetClean;
        })
        .map((sale) => {
          const rawRec = sale.paidAmount ?? sale.receivedAmount ?? sale.totalReceived ?? 0;
          const recAmt = parseFloat(String(rawRec).replace(/,/g, '')) || 0;
          
          const recDate =
            sale.receivedDate ||
            sale.paymentDate ||
            sale.updatedAt ||
            (recAmt > 0 ? sale.billDate || sale.date : '-');

          return {
            ...sale,
            receivedAmount: recAmt,
            billDate: sale.billDate || sale.date || 'N/A',
            receivedDate: recDate,
          };
        });

      const itemsSet = new Set();
      [...clientOffers, ...clientSales].forEach((doc) => {
        const items = doc.items || doc.products || [];
        items.forEach((item) => {
          const itemName = item.name || item.itemName || item.description;
          if (itemName) itemsSet.add(itemName.trim());
        });
      });

      return {
        clientName: decodeURIComponent(clientName),
        offers: clientOffers,
        sales: clientSales,
        itemList: Array.from(itemsSet),
      };
    }
  );

export default clientSlice.reducer;