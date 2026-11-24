import { Prisma } from "@prisma/client";
import { ApiError } from "../utils/apiError.js";

export function errorHandler(error, req, res, _next) {
  if (res.headersSent) {
    _next(error);
    return;
  }

  let status = error instanceof ApiError ? error.status : error.status;
  let code = error instanceof ApiError ? error.code : "REQUEST_ERROR";
  let message = error instanceof ApiError ? error.message : error.message;
  let details = error instanceof ApiError ? error.details : undefined;

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      status = 409;
      const target = error.meta?.target;
      const targets = Array.isArray(target) ? target : [target];
      if (targets.includes("email")) {
        code = "EMAIL_ALREADY_REGISTERED";
        message = "An account with this email address already exists.";
      } else {
        code = "CONFLICT";
        message = "A record with a conflicting unique value already exists.";
      }
      details = undefined;
    } else if (error.code === "P2025") {
      status = 404;
      code = "NOT_FOUND";
      message = "The requested record was not found.";
      details = undefined;
    }
  }

  if (!Number.isInteger(status) || status < 400 || status >= 600) status = 500;
  if (status >= 500) {
    code = "INTERNAL_SERVER_ERROR";
    message = "Internal server error";
    details = undefined;
    req.log?.error({ err: error, status }, "Request failed");
  } else {
    req.log?.warn({ status, code }, "Request rejected");
  }

  res.status(status).json({
    error: {
      code,
      message,
      ...(details ? { details } : {}),
    },
  });
}
