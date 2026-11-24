import assert from "node:assert/strict";
import { test } from "node:test";
import {
  calculateSellerCommission,
  canTransitionOrder,
} from "../src/services/orderRules.js";

test("order transitions follow the supported lifecycle and terminal states", () => {
  assert.equal(canTransitionOrder("PENDING", "CONFIRMED"), true);
  assert.equal(canTransitionOrder("PROCESSING", "CANCELLED"), true);
  assert.equal(canTransitionOrder("SHIPPED", "CANCELLED"), false);
  assert.equal(canTransitionOrder("COMPLETED", "CANCELLED"), false);
});

test("seller commissions are calculated with decimal rounding", () => {
  assert.equal(calculateSellerCommission("19.99", "7.5").toString(), "1.5");
  assert.equal(calculateSellerCommission("10", "0").toString(), "0");
});
