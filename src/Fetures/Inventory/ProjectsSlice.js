import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { apiClient, getApiErrorMessage } from "../../api/apiClient";
import { fetchAllPages } from "../../api/apiResources";

const projectFromApi = (project) => {
  const legacy = project.legacyData || {};
  return {
    ...legacy,
    id: project.id,
    projectName: project.projectName,
    liftQty: project.liftQuantity ?? legacy.liftQty ?? 1,
    servicingDate: project.servicingDate || legacy.servicingDate || "",
    billList: (project.serviceRecords || []).map((record) => ({
      ...(record.legacyData || {}),
      id: record.id,
      month: record.month || record.legacyData?.month || "",
      servicingDate: record.servicingDate || record.legacyData?.servicingDate || "",
      servicingStatus: record.servicingStatus || record.legacyData?.servicingStatus || "Pending",
    })),
  };
};

const apiDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
};

const projectPayload = (project) => {
  const legacyData = { ...project };
  delete legacyData.billList;
  delete legacyData.id;
  delete legacyData.needsDetailsSave;
  return {
    projectName: project.projectName,
    liftQuantity: Number(project.liftQty) || 1,
    servicingDate: apiDate(project.servicingDate),
    legacyData,
  };
};

async function saveProject(project, dispatch, getState) {
  const isNew = String(project.id || "").startsWith("proj_");
  const shouldSaveDetails = isNew || project.needsDetailsSave;
  const response = shouldSaveDetails
    ? isNew
      ? await apiClient.post("/projects", projectPayload(project))
      : await apiClient.patch(`/projects/${encodeURIComponent(project.id)}`, projectPayload(project))
    : null;
  const saved = response?.data.project || { id: project.id };
  if (isNew) {
    dispatch(setProjectId({ localId: project.id, id: saved.id }));
  }
  if (shouldSaveDetails) dispatch(markProjectDetailsSaved(saved.id));

  const billsToSave = (project.billList || []).filter((bill) => !bill.id || bill.needsSave);
  for (const billToSave of billsToSave) {
    const currentProject = getState().project?.projects.find((item) => String(item.id) === String(saved.id));
    const bill = currentProject?.billList?.find((item) => item.month === billToSave.month) || billToSave;
    const legacyData = { ...bill };
    const id = legacyData.id;
    delete legacyData.id;
    delete legacyData.needsSave;
    const body = {
      month: bill.month,
      servicingDate: apiDate(bill.servicingDate || bill.lastServicingDate),
      servicingStatus: bill.servicingStatus || "Pending",
      legacyData,
    };
    let recordResponse;
    if (id) {
      recordResponse = await apiClient.patch(
        `/projects/${encodeURIComponent(saved.id)}/service-records/${encodeURIComponent(id)}`,
        body
      );
    } else {
      recordResponse = await apiClient.post(`/projects/${encodeURIComponent(saved.id)}/service-records`, body);
    }
    const record = recordResponse.data.serviceRecord;
    dispatch(addOrUpdateBill({
      projectId: saved.id,
      billData: {
        ...legacyData,
        id: record.id,
        needsSave: false,
        month: record.month || bill.month,
        servicingDate: record.servicingDate || bill.servicingDate || "",
        servicingStatus: record.servicingStatus || bill.servicingStatus || "Pending",
      },
    }));
  }
}

export const fetchProjects = createAsyncThunk(
  "projects/fetchProjects",
  async (_, { rejectWithValue }) => {
    try {
      return (await fetchAllPages("/projects")).map(projectFromApi);
    } catch (error) {
      return rejectWithValue(getApiErrorMessage(error));
    }
  }
);

export const saveAllProjectsToApi = createAsyncThunk(
  "projects/saveAllProjects",
  async (_, { getState, dispatch, rejectWithValue }) => {
    try {
      for (const project of getState().project?.projects || []) {
        await saveProject(project, dispatch, getState);
      }
      await dispatch(fetchProjects()).unwrap();
      return true;
    } catch (error) {
      return rejectWithValue(getApiErrorMessage(error));
    }
  }
);

export const deleteProjectFromApi = createAsyncThunk(
  "projects/deleteProject",
  async (_projectId, { rejectWithValue }) =>
    rejectWithValue("Project deletion is not available: the API has no DELETE /projects/:projectId endpoint.")
);

export const saveBillToApi = createAsyncThunk(
  "projects/saveBill",
  async ({ projectId, billData }, { dispatch, rejectWithValue }) => {
    try {
      const { id, ...legacyData } = billData;
      const body = {
        month: billData.month,
        servicingDate: apiDate(billData.servicingDate || billData.lastServicingDate),
        servicingStatus: billData.servicingStatus || "Pending",
        legacyData,
      };
      let response;
      if (id) {
        response = await apiClient.patch(
          `/projects/${encodeURIComponent(projectId)}/service-records/${encodeURIComponent(id)}`,
          body
        );
      } else {
        response = await apiClient.post(
          `/projects/${encodeURIComponent(projectId)}/service-records`,
          body
        );
      }
      const saved = response.data.serviceRecord;
      const normalized = {
        ...legacyData,
        id: saved.id,
        month: saved.month || billData.month,
        servicingDate: saved.servicingDate || billData.servicingDate || "",
        servicingStatus: saved.servicingStatus || billData.servicingStatus || "Pending",
      };
      dispatch(addOrUpdateBill({ projectId, billData: normalized }));
      return { projectId, billData: normalized };
    } catch (error) {
      return rejectWithValue(getApiErrorMessage(error));
    }
  }
);

export const updateProjectServicingStatus = createAsyncThunk(
  "projects/updateProjectServicingStatus",
  async ({ projectId, month, servicingStatus, lastServicingDate }, { dispatch, rejectWithValue, getState }) => {
    try {
      const project = getState().project.projects.find((item) => String(item.id) === String(projectId));
      const bill = (project?.billList || []).find((item) => item.month === month);
      const body = {
        month,
        servicingStatus,
        servicingDate: apiDate(lastServicingDate),
        legacyData: {
          ...(bill || {}),
          month,
          servicingStatus,
          lastServicingDate,
          servicingDate: lastServicingDate,
        },
      };
      const response = bill?.id
        ? await apiClient.patch(
          `/projects/${encodeURIComponent(projectId)}/service-records/${encodeURIComponent(bill.id)}`,
          body
        )
        : await apiClient.post(`/projects/${encodeURIComponent(projectId)}/service-records`, body);
      const saved = response.data.serviceRecord;
      const billData = {
        ...(bill || {}),
        id: saved.id,
        month,
        servicingStatus,
        lastServicingDate,
        servicingDate: lastServicingDate,
      };
      dispatch(addOrUpdateBill({ projectId, billData }));
      return { projectId, billData };
    } catch (error) {
      return rejectWithValue(getApiErrorMessage(error));
    }
  }
);

export const deleteBillFromApi = createAsyncThunk(
  "projects/deleteBill",
  async (_payload, { rejectWithValue }) =>
    rejectWithValue("Deleting a project service record is not available: the API has no DELETE service-record endpoint.")
);

const projectSlice = createSlice({
  name: "project",
  initialState: {
    projects: [],
    selectedMonth: "All",
    selectedWhoseProject: "All",
    loading: false,
    error: null,
  },
  reducers: {
    setSelectedMonth: (state, action) => {
      state.selectedMonth = action.payload;
    },
    setSelectedWhoseProject: (state, action) => {
      state.selectedWhoseProject = action.payload;
    },
    addNewProjectLocal: (state, action) => {
      const servicingBill = Number(action.payload.servicingBill) || 0;
      const sparePartsBill = Number(action.payload.sparePartsBill) || 0;
      const lastMonthDue = Number(action.payload.lastMonthDue) || 0;
      const totalBill = servicingBill + sparePartsBill + lastMonthDue;
      const collectedBill = Number(action.payload.collectedBill) || 0;
      state.projects.unshift({
        ...action.payload,
        id: `proj_${Date.now()}`,
        liftQty: Number(action.payload.liftQty) || 1,
        whoseProjects: action.payload.whoseProjects || "HRE",
        billList: [{
          ...action.payload,
          month: action.payload.month || "August",
          needsSave: true,
          servicingBill,
          sparePartsBill,
          lastMonthDue,
          totalBill,
          collectedBill,
          totalDue: totalBill - collectedBill,
        }],
      });
    },
    updateProjectLocal: (state, action) => {
      const { id, month, ...fields } = action.payload;
      const project = state.projects.find((item) => String(item.id) === String(id));
      if (!project) return;
      Object.assign(project, {
        projectName: fields.projectName,
        address: fields.address,
        phoneNo: fields.phoneNo,
        liftQty: Number(fields.liftQty) || 1,
        whoseProjects: fields.whoseProjects || "HRE",
        needsDetailsSave: true,
      });
      const billMonth = month || "August";
      const index = (project.billList || []).findIndex((bill) => bill.month === billMonth);
      const bill = { ...(project.billList?.[index] || {}), ...fields, month: billMonth, needsSave: true };
      bill.totalBill = (Number(bill.servicingBill) || 0) +
        (Number(bill.sparePartsBill) || 0) + (Number(bill.lastMonthDue) || 0);
      bill.totalDue = bill.totalBill - (Number(bill.collectedBill) || 0);
      if (index >= 0) project.billList[index] = bill;
      else project.billList = [...(project.billList || []), bill];
    },
    removeProjectLocal: (state, action) => {
      state.projects = state.projects.filter((project) => String(project.id) !== String(action.payload));
    },
    setProjectId: (state, action) => {
      const project = state.projects.find((item) => String(item.id) === String(action.payload.localId));
      if (project) project.id = action.payload.id;
    },
    markProjectDetailsSaved: (state, action) => {
      const project = state.projects.find((item) => String(item.id) === String(action.payload));
      if (project) project.needsDetailsSave = false;
    },
    addOrUpdateBill: (state, action) => {
      const project = state.projects.find((item) => String(item.id) === String(action.payload.projectId));
      if (!project) return;
      const bills = project.billList || (project.billList = []);
      const index = bills.findIndex((bill) => bill.month === action.payload.billData.month);
      if (index >= 0) bills[index] = { ...bills[index], ...action.payload.billData, needsSave: false };
      else bills.push({ ...action.payload.billData, needsSave: false });
    },
    deleteMonthBill: (state, action) => {
      const project = state.projects.find((item) => String(item.id) === String(action.payload.projectId));
      if (project?.billList) {
        project.billList = project.billList.filter((bill) => bill.month !== action.payload.month);
      }
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchProjects.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchProjects.fulfilled, (state, action) => {
        state.loading = false;
        state.projects = action.payload;
      })
      .addCase(fetchProjects.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || action.error.message;
      })
      .addCase(saveAllProjectsToApi.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(saveAllProjectsToApi.fulfilled, (state) => {
        state.loading = false;
      })
      .addCase(saveAllProjectsToApi.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || action.error.message;
      })
      .addCase(deleteProjectFromApi.rejected, (state, action) => {
        state.error = action.payload || action.error.message;
      })
      .addCase(deleteBillFromApi.rejected, (state, action) => {
        state.error = action.payload || action.error.message;
      });
  },
});

export const {
  setSelectedMonth,
  setSelectedWhoseProject,
  addNewProjectLocal,
  updateProjectLocal,
  removeProjectLocal,
  setProjectId,
  markProjectDetailsSaved,
  addOrUpdateBill,
  deleteMonthBill,
} = projectSlice.actions;

export default projectSlice.reducer;
