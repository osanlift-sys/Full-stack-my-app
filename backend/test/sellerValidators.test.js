import assert from "node:assert/strict";
import { test } from "node:test";
import { sellerCommissionSchema } from "../src/validators/adminValidators.js";

test("seller commission rates are bounded percentages with four decimal places", () => {
  assert.equal(sellerCommissionSchema.safeParse({ commissionRate: "12.3456" }).success, true);
  assert.equal(sellerCommissionSchema.safeParse({ commissionRate: 0 }).success, true);
  assert.equal(sellerCommissionSchema.safeParse({ commissionRate: "100.0001" }).success, false);
  assert.equal(sellerCommissionSchema.safeParse({ commissionRate: "-1" }).success, false);
  assert.equal(sellerCommissionSchema.safeParse({ commissionRate: "1.00001" }).success, false);
});
