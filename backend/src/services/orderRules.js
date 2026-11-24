import { decimal } from "./billMath.js";

const statusTransitions = {
  PENDING: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["PROCESSING", "CANCELLED"],
  PROCESSING: ["SHIPPED", "CANCELLED"],
  SHIPPED: ["COMPLETED"],
  COMPLETED: [],
  CANCELLED: [],
};

export function canTransitionOrder(from, to) {
  return statusTransitions[from]?.includes(to) === true;
}

export function calculateSellerCommission(grossAmount, commissionRate) {
  return decimal(grossAmount)
    .mul(decimal(commissionRate))
    .div(100)
    .toDecimalPlaces(2);
}
