import { ApiError } from "../utils/apiError.js";

export function authorizeRoles(...roles) {
  return (req, _res, next) => {
    if (!req.user) {
      next(new ApiError(401, "UNAUTHENTICATED", "Please sign in to continue."));
      return;
    }
    if (!roles.includes(req.user.role)) {
      next(new ApiError(403, "FORBIDDEN", "You do not have permission to perform this action."));
      return;
    }
    next();
  };
}

export function requirePermission(permission) {
  return (req, _res, next) => {
    if (!req.user) {
      next(new ApiError(401, "UNAUTHENTICATED", "Please sign in to continue."));
      return;
    }
    if (req.user.role !== "ADMIN" && req.user.permissions[permission] !== true) {
      next(new ApiError(403, "FORBIDDEN", "You do not have permission to perform this action."));
      return;
    }
    next();
  };
}

export function requirePermissionOrClientRead(permission) {
  return (req, _res, next) => {
    if (!req.user) {
      next(new ApiError(401, "UNAUTHENTICATED", "Please sign in to continue."));
      return;
    }
    if (
      req.user.role === "ADMIN" ||
      req.user.role === "CLIENT" ||
      (req.user.role === "EMPLOYEE" && req.user.permissions[permission] === true)
    ) {
      next();
      return;
    }
    next(new ApiError(403, "FORBIDDEN", "You do not have permission to perform this action."));
  };
}
