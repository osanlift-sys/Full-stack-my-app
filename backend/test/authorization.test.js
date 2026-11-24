import assert from "node:assert/strict";
import { test } from "node:test";
import {
  authorizeRoles,
  requirePermission,
  requirePermissionOrClientRead,
} from "../src/middleware/authorize.js";

function runMiddleware(middleware, user) {
  const req = { user };
  let error;
  middleware(req, {}, (nextError) => {
    error = nextError;
  });
  return error;
}

test("role authorization denies unapproved roles and unauthenticated requests", () => {
  const requireAdmin = authorizeRoles("ADMIN");

  assert.equal(runMiddleware(requireAdmin, { role: "EMPLOYEE" }).status, 403);
  assert.equal(runMiddleware(requireAdmin, null).status, 401);
  assert.equal(runMiddleware(requireAdmin, { role: "ADMIN" }), undefined);
});

test("granular permissions are required except for administrators", () => {
  const requirePayroll = requirePermission("emp_tab_payroll");

  assert.equal(runMiddleware(requirePayroll, {
    role: "EMPLOYEE",
    permissions: { emp_tab_payroll: false },
  }).status, 403);
  assert.equal(runMiddleware(requirePayroll, {
    role: "EMPLOYEE",
    permissions: { emp_tab_payroll: true },
  }), undefined);
  assert.equal(runMiddleware(requirePayroll, {
    role: "ADMIN",
    permissions: {},
  }), undefined);
});

test("invoice reads are limited to authorized employees and clients", () => {
  const requireInvoiceRead = requirePermissionOrClientRead("clients_tab_invoice");

  assert.equal(runMiddleware(requireInvoiceRead, {
    role: "EMPLOYEE",
    permissions: { clients_tab_invoice: true },
  }), undefined);
  assert.equal(runMiddleware(requireInvoiceRead, {
    role: "EMPLOYEE",
    permissions: { clients_tab_invoice: false },
  }).status, 403);
  assert.equal(runMiddleware(requireInvoiceRead, { role: "CLIENT" }), undefined);
  assert.equal(runMiddleware(requireInvoiceRead, { role: "SELLER" }).status, 403);
});
