import { Prisma } from "@prisma/client";
import { ApiError } from "../utils/apiError.js";

const zero = new Prisma.Decimal(0);
const maximumAmount = new Prisma.Decimal("9999999999999999.99");

export function calculateOfferTotals(items, discountAmount = "0") {
  const subtotal = items.reduce((sum, item) => {
    const quantity = new Prisma.Decimal(item.quantity);
    if (quantity.lte(0)) {
      throw new ApiError(400, "INVALID_QUANTITY", "Offer item quantities must be greater than zero.");
    }
    return sum.plus(quantity.mul(new Prisma.Decimal(item.price)));
  }, zero).toDecimalPlaces(2);
  if (subtotal.gt(maximumAmount)) {
    throw new ApiError(400, "INVALID_TOTAL", "Offer total exceeds the supported financial range.");
  }
  const discount = new Prisma.Decimal(discountAmount);

  if (discount.gt(subtotal)) {
    throw new ApiError(400, "INVALID_DISCOUNT", "Discount cannot exceed the offer subtotal.");
  }

  return {
    subtotal,
    discount,
    total: subtotal.minus(discount).toDecimalPlaces(2),
  };
}
