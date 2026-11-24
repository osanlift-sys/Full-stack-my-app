import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { env } from "./env.js";

if (!env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be configured before initializing Prisma.");
}

const databaseProtocol = new URL(env.DATABASE_URL).protocol;
if (!["postgres:", "postgresql:"].includes(databaseProtocol)) {
  throw new Error("DATABASE_URL must use the PostgreSQL protocol.");
}

const prismaOptions = {
  adapter: new PrismaPg({ connectionString: env.DATABASE_URL }),
  log: env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
};

const prisma = globalThis.__osanPrisma ?? new PrismaClient(prismaOptions);

if (env.NODE_ENV !== "production") {
  globalThis.__osanPrisma = prisma;
}

export default prisma;
