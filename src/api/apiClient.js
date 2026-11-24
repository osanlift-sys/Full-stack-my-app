import axios from "axios";

export function getApiErrorMessage(error) {
  const message = error?.response?.data?.error?.message;
  return typeof message === "string" && message
    ? message
    : error?.message || "The request could not be completed.";
}

const baseURL =
  import.meta.env?.VITE_API_BASE_URL ||
  globalThis.process?.env?.VITE_API_BASE_URL ||
  "/api/v1";
const csrfClient = axios.create({ baseURL, withCredentials: true });

export const apiClient = axios.create({
  baseURL,
  withCredentials: true,
  headers: { Accept: "application/json" },
});

let csrfToken = null;
let csrfRequest = null;
let refreshRequest = null;

const authEndpointsWithoutRefresh = new Set([
  "/auth/login",
  "/auth/google",
  "/auth/register/employee",
  "/auth/register/client",
  "/auth/refresh",
  "/auth/logout",
  "/auth/password-reset/request",
  "/auth/password-reset/complete",
]);

function normalizedUrl(config) {
  return (config.url || "").split("?")[0].replace(/\/+$/, "");
}

export async function getCsrfToken() {
  if (csrfToken) return csrfToken;

  if (!csrfRequest) {
    csrfRequest = csrfClient
      .get("/auth/csrf")
      .then(({ data }) => {
        if (typeof data?.csrfToken !== "string" || !data.csrfToken) {
          throw new Error("The API did not return a CSRF token.");
        }
        csrfToken = data.csrfToken;
        return csrfToken;
      })
      .finally(() => {
        csrfRequest = null;
      });
  }

  return csrfRequest;
}

apiClient.interceptors.request.use(async (config) => {
  const method = (config.method || "get").toLowerCase();
  if (["post", "put", "patch", "delete"].includes(method)) {
    const token = await getCsrfToken();
    config.headers = config.headers || {};
    config.headers["X-CSRF-Token"] = token;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => {
    if (response.data?.csrfToken) csrfToken = response.data.csrfToken;
    return response;
  },
  async (error) => {
    const config = error.config;
    if (
      error.response?.status === 403 &&
      error.response.data?.error?.code === "CSRF_VALIDATION_FAILED" &&
      config &&
      !config._retriedAfterCsrf
    ) {
      csrfToken = null;
      config._retriedAfterCsrf = true;
      return apiClient(config);
    }

    if (
      error.response?.status !== 401 ||
      !config ||
      config._skipAuthRefresh ||
      config._retriedAfterRefresh ||
      authEndpointsWithoutRefresh.has(normalizedUrl(config))
    ) {
      return Promise.reject(error);
    }

    config._retriedAfterRefresh = true;
    if (!refreshRequest) {
      refreshRequest = apiClient
        .post("/auth/refresh", undefined, { _skipAuthRefresh: true })
        .finally(() => {
          refreshRequest = null;
        });
    }

    try {
      await refreshRequest;
      return apiClient(config);
    } catch {
      csrfToken = null;
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("backend-auth:session-expired"));
      }
      return Promise.reject(error);
    }
  }
);
