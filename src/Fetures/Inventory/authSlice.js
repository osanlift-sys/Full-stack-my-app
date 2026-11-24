import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { apiClient, getApiErrorMessage } from "../../api/apiClient";

function readSavedUser() {
  try {
    return JSON.parse(localStorage.getItem("authUser") || "null");
  } catch {
    localStorage.removeItem("authUser");
    return null;
  }
}

function toFrontendUser(user) {
  if (!user) return null;
  const roleNames = {
    ADMIN: "Admin",
    EMPLOYEE: "Employee",
    CLIENT: "Client",
    SELLER: "Seller",
  };
  return {
    ...user,
    uid: user.id,
    photoURL: user.photoUrl || null,
    role: roleNames[user.role] || user.role,
    backendRole: user.role,
  };
}

const persistUser = (user) => {
  if (user) localStorage.setItem("authUser", JSON.stringify(user));
  else localStorage.removeItem("authUser");
};

export const restoreSession = createAsyncThunk(
  "auth/restoreSession",
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await apiClient.get("/auth/me");
      const user = toFrontendUser(data.user);
      persistUser(user);
      return user;
    } catch (error) {
      persistUser(null);
      return rejectWithValue(getApiErrorMessage(error));
    }
  }
);

export const registerUser = createAsyncThunk(
  "auth/registerUser",
  async ({ name, email, password, companyName, role }, { rejectWithValue }) => {
    try {
      const isClient = role === "CLIENT";
      const path = isClient ? "/auth/register/client" : "/auth/register/employee";
      const payload = { name, email: email.trim().toLowerCase(), password };
      if (isClient) payload.companyName = companyName;
      const { data } = await apiClient.post(path, payload);
      if (data.directLogin && data.user) {
        const user = toFrontendUser(data.user);
        persistUser(user);
        return { ...data, user, isApprovedSignup: false };
      }
      return { ...data, isApprovedSignup: false };
    } catch (error) {
      return rejectWithValue(getApiErrorMessage(error));
    }
  }
);

export const loginUser = createAsyncThunk(
  "auth/loginUser",
  async ({ email, password }, { rejectWithValue }) => {
    try {
      const { data } = await apiClient.post("/auth/login", {
        email: email.trim().toLowerCase(),
        password,
      });
      const user = toFrontendUser(data.user);
      persistUser(user);
      return user;
    } catch (error) {
      return rejectWithValue(getApiErrorMessage(error));
    }
  }
);

export const googleLoginUser = createAsyncThunk(
  "auth/googleLoginUser",
  async (idToken, { rejectWithValue }) => {
    try {
      const { data } = await apiClient.post("/auth/google", { idToken });
      if (data.pendingApproval) return data;
      const user = toFrontendUser(data.user);
      persistUser(user);
      return user;
    } catch (error) {
      return rejectWithValue(getApiErrorMessage(error));
    }
  }
);

export const resetPassword = createAsyncThunk(
  "auth/resetPassword",
  async (email, { rejectWithValue }) => {
    try {
      const { data } = await apiClient.post("/auth/password-reset/request", {
        email: email.trim().toLowerCase(),
      });
      return data.message;
    } catch (error) {
      return rejectWithValue(getApiErrorMessage(error));
    }
  }
);

export const completePasswordReset = createAsyncThunk(
  "auth/completePasswordReset",
  async ({ token, password }, { rejectWithValue }) => {
    try {
      await apiClient.post("/auth/password-reset/complete", { token, password });
      return "Password reset complete. Please log in with your new password.";
    } catch (error) {
      return rejectWithValue(getApiErrorMessage(error));
    }
  }
);

export const requestEmailVerification = createAsyncThunk(
  "auth/requestEmailVerification",
  async (email, { rejectWithValue }) => {
    try {
      const { data } = await apiClient.post("/auth/email-verification/request", {
        email: email.trim().toLowerCase(),
      });
      return data.message;
    } catch (error) {
      return rejectWithValue(getApiErrorMessage(error));
    }
  }
);

export const logoutUser = createAsyncThunk(
  "auth/logoutUser",
  async (_, { rejectWithValue }) => {
    try {
      await apiClient.post("/auth/logout");
      persistUser(null);
      return true;
    } catch (error) {
      return rejectWithValue(getApiErrorMessage(error));
    }
  }
);

const authSlice = createSlice({
  name: "auth",
  initialState: {
    user: readSavedUser(),
    loading: false,
    error: null,
    successMessage: null,
  },
  reducers: {
    clearAuthMessages: (state) => {
      state.error = null;
      state.successMessage = null;
    },
    syncAuthenticatedUser: (state, action) => {
      state.user = toFrontendUser(action.payload);
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(restoreSession.fulfilled, (state, action) => {
        state.user = action.payload;
      })
      .addCase(restoreSession.rejected, (state) => {
        state.user = null;
      })
      .addCase(registerUser.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(registerUser.fulfilled, (state, action) => {
        state.loading = false;
        if (action.payload.directLogin && action.payload.user) {
          state.user = action.payload.user;
        }
        state.successMessage = action.payload.message;
      })
      .addCase(registerUser.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(loginUser.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(loginUser.fulfilled, (state, action) => {
        state.loading = false;
        state.user = action.payload;
        state.successMessage = "Login successful!";
      })
      .addCase(loginUser.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(googleLoginUser.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(googleLoginUser.fulfilled, (state, action) => {
        state.loading = false;
        if (action.payload.pendingApproval) {
          state.successMessage = action.payload.message;
        } else {
          state.user = action.payload;
          state.successMessage = "Logged in with Google!";
        }
      })
      .addCase(googleLoginUser.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(resetPassword.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(resetPassword.fulfilled, (state, action) => {
        state.loading = false;
        state.successMessage = action.payload;
      })
      .addCase(resetPassword.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(completePasswordReset.fulfilled, (state, action) => {
        state.successMessage = action.payload;
      })
      .addCase(completePasswordReset.rejected, (state, action) => {
        state.error = action.payload;
      })
      .addCase(requestEmailVerification.fulfilled, (state, action) => {
        state.successMessage = action.payload;
      })
      .addCase(requestEmailVerification.rejected, (state, action) => {
        state.error = action.payload;
      })
      .addCase(logoutUser.fulfilled, (state) => {
        state.user = null;
        state.error = null;
        state.successMessage = null;
      })
      .addCase(logoutUser.rejected, (state, action) => {
        state.error = action.payload;
      });
  },
});

export const { clearAuthMessages, syncAuthenticatedUser } = authSlice.actions;
export default authSlice.reducer;
