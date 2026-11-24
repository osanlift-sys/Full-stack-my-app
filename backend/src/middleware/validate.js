import { ApiError } from "../utils/apiError.js";

export function validateBody(schema) {
  return (req, _res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      next(new ApiError(
        400,
        "VALIDATION_ERROR",
        "Request body is invalid.",
        result.error.issues.map(({ path, message }) => ({
          field: path.join("."),
          message,
        }))
      ));
      return;
    }

    req.validatedBody = result.data;
    next();
  };
}

export function validateParams(schema) {
  return (req, _res, next) => {
    const result = schema.safeParse(req.params);
    if (!result.success) {
      next(new ApiError(
        400,
        "VALIDATION_ERROR",
        "Route parameters are invalid.",
        result.error.issues.map(({ path, message }) => ({
          field: path.join("."),
          message,
        }))
      ));
      return;
    }

    req.validatedParams = result.data;
    next();
  };
}

export function validateQuery(schema) {
  return (req, _res, next) => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      next(new ApiError(
        400,
        "VALIDATION_ERROR",
        "Query parameters are invalid.",
        result.error.issues.map(({ path, message }) => ({
          field: path.join("."),
          message,
        }))
      ));
      return;
    }

    req.validatedQuery = result.data;
    next();
  };
}
