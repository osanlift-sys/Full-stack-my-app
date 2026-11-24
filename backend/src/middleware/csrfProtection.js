import { env } from "../config/env.js";
import { authCookieNames, isValidCsrfToken } from "../utils/authTokens.js";
import { ApiError } from "../utils/apiError.js";

const safeMethods = new Set(["GET", "HEAD", "OPTIONS"]);

export function csrfProtection(req, _res, next) {
  if (safeMethods.has(req.method)) {
    next();
    return;
  }

  const origin = req.get("origin");
  if (origin && !env.FRONTEND_ORIGINS.includes(origin)) {
    next(new ApiError(403, "FORBIDDEN", "Request origin is not allowed."));
    return;
  }

  const cookieToken = req.cookies?.[authCookieNames.csrf];
  const headerToken = req.get("x-csrf-token");
  if (
    !cookieToken ||
    !headerToken ||
    cookieToken !== headerToken ||
    !isValidCsrfToken(cookieToken)
  ) {
    next(new ApiError(403, "CSRF_VALIDATION_FAILED", "Refresh the page and try again."));
    return;
  }

  next();
}
