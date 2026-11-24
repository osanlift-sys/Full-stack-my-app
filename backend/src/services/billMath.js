import { Prisma } from "@prisma/client";
import { ApiError } from "../utils/apiError.js";

const zero = new Prisma.Decimal(0);

function decimal(value) {
  return new Prisma.Decimal(value);
}

export function parseBillDate(value, label = "Bill date") {
  if (!value) return null;

  const isoDate = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  const localDate = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(value);
  let year;
  let month;
  let day;

  if (isoDate) {
    [, year, month, day] = isoDate;
  } else if (localDate) {
    [, day, month, year] = localDate;
  } else {
    throw new ApiError(400, "INVALID_DATE", `${label} must use YYYY-MM-DD or DD/MM/YYYY.`);
  }

  const parsed = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day), 12));
  if (
    parsed.getUTCFullYear() !== Number(year) ||
    parsed.getUTCMonth() !== Number(month) - 1 ||
    parsed.getUTCDate() !== Number(day)
  ) {
    throw new ApiError(400, "INVALID_DATE", `${label} is not a valid calendar date.`);
  }
  return parsed;
}

export function formatBillDate(value) {
  if (!value) return "";
  const date = new Date(value);
  return `${String(date.getUTCDate()).padStart(2, "0")}/${String(date.getUTCMonth() + 1).padStart(2, "0")}/${date.getUTCFullYear()}`;
}

export function calculateTotals(items, discountAmount) {
  const subtotal = items.reduce((sum, item) => {
    const quantity = decimal(item.quantity);
    if (quantity.lte(0)) {
      throw new ApiError(400, "INVALID_QUANTITY", "Bill item quantities must be greater than zero.");
    }
    return sum.plus(quantity.mul(decimal(item.price)));
  }, zero).toDecimalPlaces(2);
  const discount = decimal(discountAmount || "0");

  if (discount.gt(subtotal)) {
    throw new ApiError(400, "INVALID_DISCOUNT", "Discount cannot exceed the bill subtotal.");
  }

  return {
    subtotal,
    discount,
    total: subtotal.minus(discount).toDecimalPlaces(2),
  };
}

export function paymentStatusFor(paidAmount, totalAmount) {
  if (paidAmount.lte(0)) return "PENDING";
  return paidAmount.gte(totalAmount) ? "PAID" : "PARTIALLY_PAID";
}

export function billStatusFor(paidAmount, totalAmount) {
  if (paidAmount.lte(0)) return "ISSUED";
  return paidAmount.gte(totalAmount) ? "PAID" : "PARTIALLY_PAID";
}

export function validatePaymentAmount(amount, totalAmount, currentPaid) {
  if (amount.lt(currentPaid)) {
    throw new ApiError(409, "PAID_AMOUNT_CANNOT_DECREASE", "A recorded payment cannot be removed by editing a bill.");
  }
  if (amount.gt(totalAmount)) {
    throw new ApiError(400, "OVERPAYMENT", "The paid amount cannot exceed the bill total.");
  }
}

export { decimal, zero };
