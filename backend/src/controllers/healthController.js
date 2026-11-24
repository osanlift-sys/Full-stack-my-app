import prisma from "../config/database.js";

export function getHealth(_req, res) {
  res.status(200).json({
    status: "ok",
    timestamp: new Date().toISOString(),
  });
}

export async function getReadiness(req, res) {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.status(200).json({ status: "ready" });
  } catch (error) {
    req.log?.error(
      { errorCode: error.code || error.name },
      "Database readiness check failed"
    );
    res.status(503).json({
      error: { code: "SERVICE_UNAVAILABLE", message: "Backend dependencies are unavailable." },
    });
  }
}
