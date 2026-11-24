import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { apiClient, getApiErrorMessage } from "../../api/apiClient";

const currentMonth = new Date().toLocaleString("en-US", {
  month: "long",
  year: "numeric",
});

function monthToApiValue(value) {
  const parsed = new Date(`${value} 1`);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error("Select a valid payroll month.");
  }
  return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, "0")}`;
}

function toPayrollRow(item) {
  const baseSalary = Number(item.baseSalary) || 0;
  const advanceDeduction = Number(item.advanceDeduction) || 0;
  const fridayAllowance = Number(item.fridayAllowance) || 0;
  const netPayable = Number(item.netPayable) || 0;
  const presentDays = Number(item.presentDays) || 0;
  const leaveDays = Number(item.leaveDays) || 0;
  const workedFridays = Number(item.workedFridays) || 0;
  return {
    ...item,
    id: item.employeeId || item.id,
    email: item.employee?.email || "",
    name: item.employee?.name || item.name || "",
    cleanName: item.employee?.email || item.employeeId || item.id,
    presentDays,
    leaveDays,
    workedFridays,
    fridayAllowance,
    absentDays: Number(item.absentDays) || 0,
    totalPayableDays: presentDays + leaveDays,
    dailyRate: Math.round(baseSalary / 30),
    grossPayable: Math.max(0, netPayable - fridayAllowance + advanceDeduction),
  };
}

export const fetchPayrollData = createAsyncThunk(
  "payroll/fetchPayrollData",
  async (selectedMonth, { getState, rejectWithValue }) => {
    try {
      const month = monthToApiValue(selectedMonth);
      if (getState().auth.user?.backendRole === "ADMIN") {
        await apiClient.post("/payroll/recalculate", undefined, { params: { month } });
      }
      const { data } = await apiClient.get("/payroll", { params: { month, page: 1, limit: 100 } });
      return data.items.map(toPayrollRow);
    } catch (error) {
      return rejectWithValue(getApiErrorMessage(error));
    }
  }
);

export const updateEmployeeSalaryDetails = createAsyncThunk(
  "payroll/updateSalary",
  async ({ empId, baseSalary, advanceDeduction }, { dispatch, getState, rejectWithValue }) => {
    try {
      await apiClient.patch(`/payroll/employees/${encodeURIComponent(empId)}/salary`, {
        baseSalary: String(baseSalary),
        advanceDeduction: String(advanceDeduction),
      });
      await dispatch(fetchPayrollData(getState().payroll.selectedMonth)).unwrap();
    } catch (error) {
      return rejectWithValue(getApiErrorMessage(error));
    }
  }
);

const payrollSlice = createSlice({
  name: "payroll",
  initialState: {
    selectedMonth: currentMonth,
    payrollData: [],
    loading: false,
    error: null,
  },
  reducers: {
    setSelectedMonth: (state, action) => {
      state.selectedMonth = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchPayrollData.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchPayrollData.fulfilled, (state, action) => {
        state.loading = false;
        state.payrollData = action.payload;
      })
      .addCase(fetchPayrollData.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(updateEmployeeSalaryDetails.rejected, (state, action) => {
        state.error = action.payload;
      });
  },
});

export const { setSelectedMonth } = payrollSlice.actions;
export default payrollSlice.reducer;
