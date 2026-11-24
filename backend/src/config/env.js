import "dotenv/config";
import { z } from "zod";

const booleanFromString = z
  .enum(["true", "false"])
  .default("false")
  .transform((value) => value === "true");

const optionalString = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.string().optional()
);

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
  FRONTEND_ORIGINS: z.string().default("http://localhost:5173"),
  TRUST_PROXY: booleanFromString,
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(900000),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(300),
  DATABASE_URL: optionalString,
  BOOTSTRAP_ADMIN_EMAIL: optionalString,
  JWT_ACCESS_SECRET: optionalString,
  ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().default(900),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(30),
  PASSWORD_RESET_TTL_MINUTES: z.coerce.number().int().positive().default(30),
  COOKIE_SECURE: booleanFromString,
  COOKIE_SAME_SITE: z.enum(["lax", "strict", "none"]).default("lax"),
  COOKIE_DOMAIN: optionalString,
  FRONTEND_BASE_URL: z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.string().url().optional()
  ),
  GOOGLE_CLIENT_ID: optionalString,
  GEMINI_API_KEY: optionalString,
  SMTP_HOST: optionalString,
  SMTP_PORT: z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.coerce.number().int().positive().optional()
  ),
  SMTP_USER: optionalString,
  SMTP_PASSWORD: optionalString,
  SMTP_FROM: z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.string().email().optional()
  ),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  const details = parsedEnv.error.issues
    .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
    .join("; ");
  throw new Error(`Invalid backend environment configuration: ${details}`);
}

export const env = Object.freeze({
  ...parsedEnv.data,
  FRONTEND_ORIGINS: parsedEnv.data.FRONTEND_ORIGINS
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
});

export function assertRuntimeConfig() {
  const missing = [];

  if (!env.DATABASE_URL) missing.push("DATABASE_URL");
  if (!env.JWT_ACCESS_SECRET || env.JWT_ACCESS_SECRET.length < 32) {
    missing.push("JWT_ACCESS_SECRET (at least 32 characters)");
  }
  if (!env.FRONTEND_BASE_URL) missing.push("FRONTEND_BASE_URL");
  if (!env.GOOGLE_CLIENT_ID) missing.push("GOOGLE_CLIENT_ID");
  if (!env.SMTP_HOST) missing.push("SMTP_HOST");
  if (!env.SMTP_PORT) missing.push("SMTP_PORT");
  if (!env.SMTP_FROM) missing.push("SMTP_FROM");
  if (Boolean(env.SMTP_USER) !== Boolean(env.SMTP_PASSWORD)) {
    missing.push("SMTP_USER and SMTP_PASSWORD must be configured together");
  }
  if (env.NODE_ENV === "production" && !env.COOKIE_SECURE) {
    missing.push("COOKIE_SECURE=true in production");
  }
  if (env.COOKIE_SAME_SITE === "none" && !env.COOKIE_SECURE) {
    missing.push("COOKIE_SECURE=true when COOKIE_SAME_SITE=none");
  }
  if (missing.length) {
    throw new Error(`Backend configuration is incomplete: ${missing.join(", ")}`);
  }
}
