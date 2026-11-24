import assert from "node:assert/strict";
import { test } from "node:test";
import {
  productCreateSchema,
  productUpdateSchema,
  stockAdjustmentSchema,
} from "../src/validators/productValidators.js";
import { assertSellerAssignmentAllowed } from "../src/services/productAccess.js";

test("product validation requires a name and accepts bounded decimal values", () => {
  const parsed = productCreateSchema.safeParse({
    name: "Lift motor",
    unitPrice: 1250.5,
    sellingPrice: "1500.00",
    stockQuantity: "2.500",
    images: [{ url: "https://cdn.example.test/motor.png", sizeBytes: 1200 }],
  });

  assert.equal(parsed.success, true);
  assert.equal(parsed.data.unitPrice, "1250.5");
  assert.equal(parsed.data.stockQuantity, "2.500");
  assert.equal(productCreateSchema.safeParse({ unitPrice: "1.001" }).success, false);
});

test("product validation rejects unsafe image URLs", () => {
  assert.equal(productCreateSchema.safeParse({
    name: "Lift motor",
    images: [{ url: "javascript:alert(1)" }],
  }).success, false);
});

test("only administrators may assign products to a seller", () => {
  assert.throws(
    () => assertSellerAssignmentAllowed({ role: "SELLER" }, "another-seller"),
    { status: 403, code: "SELLER_ASSIGNMENT_FORBIDDEN" }
  );
  assert.throws(
    () => assertSellerAssignmentAllowed({ role: "EMPLOYEE" }, null),
    { status: 403, code: "SELLER_ASSIGNMENT_FORBIDDEN" }
  );
  assert.doesNotThrow(
    () => assertSellerAssignmentAllowed({ role: "ADMIN" }, "seller-profile-id")
  );
});

test("product update and stock adjustment enforce non-empty valid changes", () => {
  assert.equal(productUpdateSchema.safeParse({}).success, false);
  assert.equal(productUpdateSchema.safeParse({ stockQuantity: "3" }).success, false);
  assert.equal(stockAdjustmentSchema.safeParse({
    direction: "OUT",
    quantity: "1.250",
    reason: "Damaged stock",
  }).success, true);
  assert.equal(stockAdjustmentSchema.safeParse({
    direction: "OUT",
    quantity: "0",
    reason: "Damaged stock",
  }).success, false);
});
