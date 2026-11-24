import assert from "node:assert/strict";
import { after, before, test } from "node:test";

let server;
let baseUrl;
let app;

before(async () => {
  process.env.JWT_ACCESS_SECRET = "test-only-jwt-secret-with-at-least-32-characters";
  process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";
  ({ default: app } = await import("../src/app.js"));
  server = app.listen(0);
  await new Promise((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
});

test("health endpoint reports service status and security headers", async () => {
  const response = await fetch(`${baseUrl}/api/v1/health`);
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.status, "ok");
  assert.ok(Number.isFinite(Date.parse(body.timestamp)));
  assert.ok(response.headers.has("content-security-policy"));
});

test("unknown API routes return a structured 404", async () => {
  const response = await fetch(`${baseUrl}/api/v1/missing`);
  const body = await response.json();

  assert.equal(response.status, 404);
  assert.equal(body.error.code, "NOT_FOUND");
});

test("admin routes require an authenticated session", async () => {
  const response = await fetch(`${baseUrl}/api/v1/admin/employee-requests`);
  const body = await response.json();

  assert.equal(response.status, 401);
  assert.equal(body.error.code, "UNAUTHENTICATED");
});

test("bill routes require an authenticated session", async () => {
  const response = await fetch(`${baseUrl}/api/v1/bills`);
  const body = await response.json();

  assert.equal(response.status, 401);
  assert.equal(body.error.code, "UNAUTHENTICATED");
});

test("offer routes require an authenticated session", async () => {
  const response = await fetch(`${baseUrl}/api/v1/offers`);
  const body = await response.json();

  assert.equal(response.status, 401);
  assert.equal(body.error.code, "UNAUTHENTICATED");
});

test("private product routes require an authenticated session", async () => {
  const response = await fetch(`${baseUrl}/api/v1/products`);
  const body = await response.json();

  assert.equal(response.status, 401);
  assert.equal(body.error.code, "UNAUTHENTICATED");
});

test("seller routes require an authenticated session", async () => {
  const response = await fetch(`${baseUrl}/api/v1/seller/me`);
  const body = await response.json();

  assert.equal(response.status, 401);
  assert.equal(body.error.code, "UNAUTHENTICATED");
});

test("order routes require an authenticated session", async () => {
  const response = await fetch(`${baseUrl}/api/v1/orders`);
  const body = await response.json();

  assert.equal(response.status, 401);
  assert.equal(body.error.code, "UNAUTHENTICATED");
});

test("support routes require an authenticated session", async () => {
  const response = await fetch(`${baseUrl}/api/v1/support/requests`);
  const body = await response.json();

  assert.equal(response.status, 401);
  assert.equal(body.error.code, "UNAUTHENTICATED");
});

test("report routes require an authenticated session", async () => {
  const response = await fetch(`${baseUrl}/api/v1/reports/dashboard`);
  const body = await response.json();

  assert.equal(response.status, 401);
  assert.equal(body.error.code, "UNAUTHENTICATED");
});

test("attendance and payroll routes require an authenticated session", async () => {
  for (const path of [
    "/api/v1/attendance",
    "/api/v1/attendance/requests",
    "/api/v1/payroll?month=2026-11",
  ]) {
    const response = await fetch(`${baseUrl}${path}`);
    const body = await response.json();
    assert.equal(response.status, 401, path);
    assert.equal(body.error.code, "UNAUTHENTICATED", path);
  }
});

test("challan, project and service schedule routes require an authenticated session", async () => {
  for (const path of [
    "/api/v1/challans",
    "/api/v1/projects",
    "/api/v1/projects/project-id/service-records",
    "/api/v1/projects/project-id/checklists",
  ]) {
    const response = await fetch(`${baseUrl}${path}`);
    const body = await response.json();
    assert.equal(response.status, 401, path);
    assert.equal(body.error.code, "UNAUTHENTICATED", path);
  }
});

test("checklist generation requires an authenticated session and CSRF token", async () => {
  const csrfResponse = await fetch(`${baseUrl}/api/v1/auth/csrf`);
  const { csrfToken } = await csrfResponse.json();
  const response = await fetch(`${baseUrl}/api/v1/projects/project-id/checklists/generate`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie: `csrfToken=${csrfToken}`,
      "x-csrf-token": csrfToken,
      origin: "http://localhost:5173",
    },
    body: JSON.stringify({ workDescription: "Routine service" }),
  });
  const body = await response.json();
  assert.equal(response.status, 401);
  assert.equal(body.error.code, "UNAUTHENTICATED");
});

test("income, notification and purchase routes require an authenticated session", async () => {
  for (const path of [
    "/api/v1/income",
    "/api/v1/income/employees",
    "/api/v1/notifications",
    "/api/v1/purchases",
  ]) {
    const response = await fetch(`${baseUrl}${path}`);
    const body = await response.json();
    assert.equal(response.status, 401, path);
    assert.equal(body.error.code, "UNAUTHENTICATED", path);
  }
});

test("domain mutation endpoints are mounted behind authentication", async () => {
  const csrfResponse = await fetch(`${baseUrl}/api/v1/auth/csrf`);
  const { csrfToken } = await csrfResponse.json();
  const endpoints = [
    ["PUT", "/api/v1/attendance"],
    ["PATCH", "/api/v1/attendance/record-id"],
    ["DELETE", "/api/v1/attendance/record-id"],
    ["POST", "/api/v1/attendance/requests"],
    ["PATCH", "/api/v1/attendance/requests/request-id/review"],
    ["PATCH", "/api/v1/admin/users/user-id/profile"],
    ["POST", "/api/v1/payroll/recalculate?month=2026-11"],
    ["PATCH", "/api/v1/payroll/employees/employee-id/salary"],
    ["POST", "/api/v1/challans"],
    ["PATCH", "/api/v1/challans/challan-id"],
    ["POST", "/api/v1/projects"],
    ["PATCH", "/api/v1/projects/project-id"],
    ["DELETE", "/api/v1/projects/project-id"],
    ["POST", "/api/v1/projects/project-id/service-records"],
    ["PATCH", "/api/v1/projects/project-id/service-records/record-id"],
    ["DELETE", "/api/v1/projects/project-id/service-records/record-id"],
    ["POST", "/api/v1/projects/project-id/checklists"],
    ["POST", "/api/v1/projects/project-id/checklists/generate"],
    ["POST", "/api/v1/projects/project-id/checklists/checklist-id/approve"],
    ["PATCH", "/api/v1/projects/project-id/checklists/checklist-id/tasks"],
    ["POST", "/api/v1/income"],
    ["PATCH", "/api/v1/income/income-id"],
    ["POST", "/api/v1/notifications"],
    ["PATCH", "/api/v1/notifications/notification-id/read"],
    ["POST", "/api/v1/purchases"],
  ];

  for (const [method, path] of endpoints) {
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        "content-type": "application/json",
        cookie: `csrfToken=${csrfToken}`,
        "x-csrf-token": csrfToken,
      },
      body: method === "DELETE" ? undefined : "{}",
    });
    const body = await response.json();
    assert.equal(response.status, 401, `${method} ${path}`);
    assert.equal(body.error.code, "UNAUTHENTICATED", `${method} ${path}`);
  }
});

test("unapproved browser origins are rejected", async () => {
  const response = await fetch(`${baseUrl}/api/v1/health`, {
    headers: { Origin: "https://untrusted.example" },
  });

  assert.equal(response.status, 403);
  assert.equal(response.headers.get("access-control-allow-origin"), null);
});

test("development CORS allows Vite on a fallback localhost port", async () => {
  const origin = "http://localhost:5174";
  const response = await fetch(`${baseUrl}/api/v1/health`, {
    headers: { Origin: origin },
  });

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("access-control-allow-origin"), origin);
  assert.equal(response.headers.get("access-control-allow-credentials"), "true");
});

test("unsafe auth requests require a signed CSRF token", async () => {
  const csrfResponse = await fetch(`${baseUrl}/api/v1/auth/csrf`);
  const { csrfToken } = await csrfResponse.json();
  const response = await fetch(`${baseUrl}/api/v1/auth/login`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie: `csrfToken=${csrfToken}`,
      "x-csrf-token": csrfToken,
      origin: "http://localhost:5173",
    },
    body: JSON.stringify({ email: "not-an-email", password: "" }),
  });
  const body = await response.json();

  assert.equal(response.status, 400);
  assert.equal(body.error.code, "VALIDATION_ERROR");
});

test("registration rejects client-supplied role assignments", async () => {
  const csrfResponse = await fetch(`${baseUrl}/api/v1/auth/csrf`);
  const { csrfToken } = await csrfResponse.json();
  const response = await fetch(`${baseUrl}/api/v1/auth/register/client`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie: `csrfToken=${csrfToken}`,
      "x-csrf-token": csrfToken,
      origin: "http://localhost:5173",
    },
    body: JSON.stringify({
      email: "client@example.com",
      name: "Client User",
      password: "long-test-password",
      companyName: "Example Company",
      role: "ADMIN",
    }),
  });
  const body = await response.json();

  assert.equal(response.status, 400);
  assert.equal(body.error.code, "VALIDATION_ERROR");
});

test("access tokens are signed and CSRF tokens reject tampering", async () => {
  const { createAccessToken, createCsrfToken, isValidCsrfToken, verifyAccessToken } =
    await import("../src/utils/authTokens.js");
  const accessToken = createAccessToken("user-id", "session-id");
  const csrfToken = createCsrfToken();

  assert.equal(verifyAccessToken(accessToken).sub, "user-id");
  assert.equal(verifyAccessToken(accessToken).sid, "session-id");
  assert.equal(isValidCsrfToken(csrfToken), true);
  assert.equal(isValidCsrfToken(`${csrfToken}x`), false);
  assert.throws(() => verifyAccessToken(`${accessToken}x`), { status: 401 });
});

test("access and refresh tokens are only written to HTTP-only cookies", async () => {
  const { setAuthCookies } = await import("../src/utils/authTokens.js");
  const cookies = [];
  const response = {
    cookie(name, value, options) {
      cookies.push({ name, value, options });
    },
  };
  const csrfToken = setAuthCookies(response, "user-id", "session-id", "opaque-refresh-token");

  assert.equal(cookies.find(({ name }) => name === "accessToken").options.httpOnly, true);
  assert.equal(cookies.find(({ name }) => name === "refreshToken").options.httpOnly, true);
  assert.equal(cookies.find(({ name }) => name === "refreshToken").value, "opaque-refresh-token");
  assert.equal(cookies.find(({ name }) => name === "csrfToken").options.httpOnly, false);
  assert.equal(csrfToken, cookies.find(({ name }) => name === "csrfToken").value);
});
