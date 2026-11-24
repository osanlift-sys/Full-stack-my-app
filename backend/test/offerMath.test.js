import assert from "node:assert/strict";
import { test } from "node:test";
import { calculateOfferTotals } from "../src/services/offerMath.js";

test("offer totals use decimal arithmetic and cap discounts", () => {
  const totals = calculateOfferTotals([
    { quantity: "3", price: "0.10" },
    { quantity: "1.5", price: "10.20" },
  ], "0.15");

  assert.equal(totals.subtotal.toString(), "15.6");
  assert.equal(totals.discount.toString(), "0.15");
  assert.equal(totals.total.toString(), "15.45");
  assert.throws(
    () => calculateOfferTotals([{ quantity: "1", price: "2" }], "2.01"),
    { code: "INVALID_DISCOUNT" }
  );
});

test("offer totals reject zero quantities and values beyond database precision", () => {
  assert.throws(
    () => calculateOfferTotals([{ quantity: "0", price: "2" }]),
    { code: "INVALID_QUANTITY" }
  );
  assert.throws(
    () => calculateOfferTotals([{ quantity: "999999999", price: "999999999999" }]),
    { code: "INVALID_TOTAL" }
  );
});
