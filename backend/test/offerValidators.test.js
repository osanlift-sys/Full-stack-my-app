import assert from "node:assert/strict";
import { test } from "node:test";
import { offerCreateSchema, offerUpdateSchema } from "../src/validators/offerValidators.js";

test("offer validation preserves line-item data and accepts existing UI totals", () => {
  const result = offerCreateSchema.safeParse({
    headerData: { toCompany: "Example Co", date: "11/17/2026", customField: "kept" },
    items: [{ name: "Lift", quantity: 1, unit: "Pcs", price: 250, taxCode: "A" }],
    subtotal: 250,
    discountAmount: 10,
    grandTotal: 240,
    notes: ["One year warranty"],
    paymentMode: { mode: "cash" },
  });

  assert.equal(result.success, true);
  assert.equal(result.data.items[0].taxCode, "A");
  assert.equal(result.data.headerData.customField, "kept");
});

test("offer validation rejects invalid quantities and client-assigned offer numbers", () => {
  const base = {
    headerData: { toCompany: "Example Co" },
    items: [{ name: "Lift", quantity: 0, price: 250 }],
  };
  assert.equal(offerCreateSchema.safeParse(base).success, false);
  assert.equal(offerCreateSchema.safeParse({
    ...base,
    items: [{ name: "Lift", quantity: 1, price: 250 }],
    offerNo: "10000001",
  }).success, false);
  assert.equal(offerUpdateSchema.safeParse({}).success, false);
});
