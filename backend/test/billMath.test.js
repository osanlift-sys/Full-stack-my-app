import assert from "node:assert/strict";
import { test } from "node:test";
import { Prisma } from "@prisma/client";
import {
  billStatusFor,
  calculateTotals,
  formatBillDate,
  parseBillDate,
  paymentStatusFor,
  validatePaymentAmount,
} from "../src/services/billMath.js";
import { ApiError } from "../src/utils/apiError.js";

test("bill totals use decimal arithmetic and reject excess discounts", () => {
  const totals = calculateTotals([
    { quantity: "3", price: "0.10" },
    { quantity: "2", price: "0.20" },
  ], "0.05");

  assert.equal(totals.subtotal.toString(), "0.7");
  assert.equal(totals.discount.toString(), "0.05");
  assert.equal(totals.total.toString(), "0.65");
  assert.throws(
    () => calculateTotals([{ quantity: "1", price: "10" }], "10.01"),
    { code: "INVALID_DISCOUNT" }
  );
  assert.throws(
    () => calculateTotals([{ quantity: "0", price: "10" }], "0"),
    { code: "INVALID_QUANTITY" }
  );
});

test("bill dates round-trip and reject impossible dates", () => {
  const date = parseBillDate("29/02/2024");
  assert.equal(formatBillDate(date), "29/02/2024");
  assert.equal(formatBillDate(parseBillDate("2025-03-08")), "08/03/2025");
  assert.throws(() => parseBillDate("31/02/2025"), {
    code: "INVALID_DATE",
  });
  assert.throws(() => parseBillDate("not-a-date"), {
    code: "INVALID_DATE",
  });
});

test("payment and bill statuses distinguish unpaid, partial, and paid", () => {
  const total = new Prisma.Decimal("100");
  assert.equal(paymentStatusFor(new Prisma.Decimal("0"), total), "PENDING");
  assert.equal(billStatusFor(new Prisma.Decimal("0"), total), "ISSUED");
  assert.equal(paymentStatusFor(new Prisma.Decimal("25"), total), "PARTIALLY_PAID");
  assert.equal(billStatusFor(new Prisma.Decimal("100"), total), "PAID");
});

test("recorded payments cannot be decreased or exceed the total", () => {
  const currentPaid = new Prisma.Decimal("10");
  assert.throws(
    () => validatePaymentAmount(new Prisma.Decimal("9"), new Prisma.Decimal("100"), currentPaid),
    (error) => error instanceof ApiError && error.status === 409
  );
  assert.throws(
    () => validatePaymentAmount(new Prisma.Decimal("101"), new Prisma.Decimal("100"), currentPaid),
    (error) => error instanceof ApiError && error.status === 400
  );
});
