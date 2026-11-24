import { ApiError } from "../utils/apiError.js";

export function assertSellerAssignmentAllowed(user, sellerId) {
  if (sellerId !== undefined && user.role !== "ADMIN") {
    throw new ApiError(
      403,
      "SELLER_ASSIGNMENT_FORBIDDEN",
      "Only administrators can assign or reassign products to sellers."
    );
  }
}
