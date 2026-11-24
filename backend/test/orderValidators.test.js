import assert from "node:assert/strict";
import { test } from "node:test";
import {
  checkoutSchema,
  orderPaymentSchema,
  orderStatusSchema,
} from "../src/validators/orderValidators.js";

test("checkout accepts product IDs and bounded positive quantities only", () => {
  assert.equal(checkoutSchema.safeParse({
    companyId: "company-id",
    items: [{ productId: "product-id", quantity: "1.250" }],
  }).success, true);
  assert.equal(checkoutSchema.safeParse({
    companyId: "company-id",
    items: [{ productId: "product-id", quantity: "0" }],
  }).success, false);
});

test("order updates accept only supported status values and valid payments", () => {
  assert.equal(orderStatusSchema.safeParse({ status: "SHIPPED" }).success, true);
  assert.equal(orderStatusSchema.safeParse({ status: "PENDING" }).success, false);
  assert.equal(orderPaymentSchema.safeParse({
    amount: "12.50",
    paymentMethod: "Bank transfer",
  }).success, true);
  assert.equal(orderPaymentSchema.safeParse({
    amount: "-1",
    paymentMethod: "Bank transfer",
  }).success, false);
});
