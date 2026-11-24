import cors from "cors";
import cookieParser from "cookie-parser";
import express from "express";
import { rateLimit } from "express-rate-limit";
import { fileURLToPath } from "node:url";
import helmet from "helmet";
import pinoHttp from "pino-http";
import { env } from "./config/env.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { notFound } from "./middleware/notFound.js";
import { csrfProtection } from "./middleware/csrfProtection.js";
import adminRoutes from "./routes/adminRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import billRoutes from "./routes/billRoutes.js";
import healthRoutes from "./routes/healthRoutes.js";
import productRoutes from "./routes/productRoutes.js";
import orderRoutes from "./routes/orderRoutes.js";
import offerRoutes from "./routes/offerRoutes.js";
import sellerRoutes from "./routes/sellerRoutes.js";
import supportRoutes from "./routes/supportRoutes.js";
import reportRoutes from "./routes/reportRoutes.js";
import {
  attendanceRoutes,
  challanRoutes,
  incomeRoutes,
  notificationRoutes,
  payrollRoutes,
  projectRoutes,
  purchaseRoutes,
} from "./routes/domainRoutes.js";
import { logger } from "./utils/logger.js";

const app = express();
const uploadsDirectory = fileURLToPath(new URL("../uploads/", import.meta.url));
const isLocalDevelopmentOrigin = (origin) => {
  if (env.NODE_ENV !== "development") return false;

  let parsedOrigin;
  try {
    parsedOrigin = new URL(origin);
  } catch {
    return false;
  }

  return (
    parsedOrigin.origin === origin &&
    parsedOrigin.protocol === "http:" &&
    ["localhost", "127.0.0.1", "[::1]"].includes(parsedOrigin.hostname)
  );
};

if (env.TRUST_PROXY) {
  app.set("trust proxy", 1);
}

app.disable("x-powered-by");
app.use(pinoHttp({
  logger,
  serializers: {
    req: (req) => ({
      id: req.id,
      method: req.method,
      url: req.url,
      remoteAddress: req.remoteAddress,
    }),
    res: (res) => ({ statusCode: res.statusCode }),
  },
}));
app.use(helmet());
app.use(cors({
  origin(origin, callback) {
    if (!origin || env.FRONTEND_ORIGINS.includes(origin) || isLocalDevelopmentOrigin(origin)) {
      callback(null, true);
      return;
    }

    const error = new Error("Origin is not allowed by CORS");
    error.status = 403;
    callback(error);
  },
  credentials: true,
}));
app.use(express.json({ limit: "1mb" }));
app.use("/uploads", express.static(uploadsDirectory, {
  immutable: true,
  maxAge: "1d",
}));
app.use("/api/v1", cookieParser(), csrfProtection);
app.use(rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  limit: env.RATE_LIMIT_MAX,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  handler: (_req, res) => {
    res.status(429).json({
      error: { code: "RATE_LIMITED", message: "Too many requests. Please try again later." },
    });
  },
}));

app.use("/api/v1/health", healthRoutes);
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/admin", adminRoutes);
app.use("/api/v1/bills", billRoutes);
app.use("/api/v1/offers", offerRoutes);
app.use("/api/v1/products", productRoutes);
app.use("/api/v1/seller", sellerRoutes);
app.use("/api/v1/orders", orderRoutes);
app.use("/api/v1/support", supportRoutes);
app.use("/api/v1/reports", reportRoutes);
app.use("/api/v1/attendance", attendanceRoutes);
app.use("/api/v1/payroll", payrollRoutes);
app.use("/api/v1/challans", challanRoutes);
app.use("/api/v1/projects", projectRoutes);
app.use("/api/v1/income", incomeRoutes);
app.use("/api/v1/notifications", notificationRoutes);
app.use("/api/v1/purchases", purchaseRoutes);
app.use(notFound);
app.use(errorHandler);

export default app;
