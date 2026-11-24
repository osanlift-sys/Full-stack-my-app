import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { ApiError } from "./apiError.js";

export const authCookieNames = Object.freeze({
  access: "accessToken",
  refresh: "refreshToken",
  csrf: "csrfToken",
});

export const hashOpaqueToken = (token) =>
  createHash("sha256").update(token).digest("hex");

function accessTokenSecret() {
  if (!env.JWT_ACCESS_SECRET || env.JWT_ACCESS_SECRET.length < 32) {
    throw new Error("JWT_ACCESS_SECRET must contain at least 32 characters.");
  }
  return env.JWT_ACCESS_SECRET;
}

export function createAccessToken(userId, sessionId) {
  return jwt.sign({ sub: userId, sid: sessionId, tokenType: "access" }, accessTokenSecret(), {
    algorithm: "HS256",
    expiresIn: env.ACCESS_TOKEN_TTL_SECONDS,
    issuer: "osan-lift-api",
    audience: "osan-lift-client",
  });
}

export function verifyAccessToken(token) {
  try {
    const payload = jwt.verify(token, accessTokenSecret(), {
      algorithms: ["HS256"],
      issuer: "osan-lift-api",
      audience: "osan-lift-client",
    });
    if (
      typeof payload === "string" ||
      payload.tokenType !== "access" ||
      !payload.sub ||
      !payload.sid
    ) {
      throw new ApiError(401, "UNAUTHENTICATED", "Please sign in to continue.");
    }
    return payload;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (error instanceof jwt.TokenExpiredError || error instanceof jwt.JsonWebTokenError) {
      throw new ApiError(401, "UNAUTHENTICATED", "Please sign in to continue.");
    }
    throw error;
  }
}

export function createRefreshToken() {
  return randomBytes(48).toString("base64url");
}

function sharedCookieOptions() {
  return {
    secure: env.COOKIE_SECURE,
    sameSite: env.COOKIE_SAME_SITE,
    ...(env.COOKIE_DOMAIN ? { domain: env.COOKIE_DOMAIN } : {}),
  };
}

export function setCsrfCookie(res) {
  const csrfToken = createCsrfToken();
  res.cookie(authCookieNames.csrf, csrfToken, {
    ...sharedCookieOptions(),
    httpOnly: false,
    path: "/api/v1",
    maxAge: env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000,
  });
  return csrfToken;
}

export function setAuthCookies(res, userId, sessionId, refreshToken) {
  const csrfToken = setCsrfCookie(res);

  res.cookie(authCookieNames.access, createAccessToken(userId, sessionId), {
    ...sharedCookieOptions(),
    httpOnly: true,
    path: "/api/v1",
    maxAge: env.ACCESS_TOKEN_TTL_SECONDS * 1000,
  });
  res.cookie(authCookieNames.refresh, refreshToken, {
    ...sharedCookieOptions(),
    httpOnly: true,
    path: "/api/v1/auth",
    maxAge: env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000,
  });

  return csrfToken;
}

export function createCsrfToken() {
  const value = randomBytes(32).toString("base64url");
  const signature = createHmac("sha256", accessTokenSecret())
    .update(value)
    .digest("base64url");
  return `${value}.${signature}`;
}

export function isValidCsrfToken(token) {
  if (typeof token !== "string") return false;
  const separator = token.indexOf(".");
  if (separator <= 0) return false;

  const value = token.slice(0, separator);
  const signature = token.slice(separator + 1);
  const expected = createHmac("sha256", accessTokenSecret())
    .update(value)
    .digest();
  let actual;

  try {
    actual = Buffer.from(signature, "base64url");
  } catch {
    return false;
  }

  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function clearAuthCookies(res) {
  const sharedOptions = sharedCookieOptions();
  res.clearCookie(authCookieNames.access, { ...sharedOptions, path: "/api/v1" });
  res.clearCookie(authCookieNames.refresh, { ...sharedOptions, path: "/api/v1/auth" });
  res.clearCookie(authCookieNames.csrf, { ...sharedOptions, path: "/api/v1" });
}
