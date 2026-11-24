import assert from "node:assert/strict";
import { test } from "node:test";
import {
  reportDateQuerySchema,
  reportListQuerySchema,
} from "../src/validators/reportValidators.js";

test("report date ranges require valid calendar dates in chronological order", () => {
  assert.equal(reportDateQuerySchema.safeParse({
    from: "2025-01-01",
    to: "2025-12-31",
  }).success, true);
  assert.equal(reportDateQuerySchema.safeParse({
    from: "2025-12-31",
    to: "2025-01-01",
  }).success, false);
  assert.equal(reportDateQuerySchema.safeParse({ from: "2025-02-30" }).success, false);
});

test("report list filters are paginated and bounded", () => {
  const parsed = reportListQuerySchema.safeParse({ page: "2", limit: "50" });
  assert.equal(parsed.success, true);
  assert.equal(parsed.data.page, 2);
  assert.equal(parsed.data.limit, 50);
  assert.equal(reportListQuerySchema.safeParse({ limit: "101" }).success, false);
});
