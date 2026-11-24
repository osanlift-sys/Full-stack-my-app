import { assertRuntimeConfig, env } from "./config/env.js";
import { logger } from "./utils/logger.js";

let server;
let prisma;

try {
  assertRuntimeConfig();
  const [{ default: database }, { default: app }] = await Promise.all([
    import("./config/database.js"),
    import("./app.js"),
  ]);
  prisma = database;
  await prisma.$connect();
  server = app.listen(env.PORT, () => {
    logger.info({ port: env.PORT, environment: env.NODE_ENV }, "Backend listening");
  });
} catch (error) {
  logger.fatal(
    { errorCode: error.code || error.name },
    "Backend startup failed. Check environment configuration and PostgreSQL availability."
  );
  if (prisma) {
    await prisma.$disconnect().catch((disconnectError) => {
      logger.error(
        { errorCode: disconnectError.code || disconnectError.name },
        "Database shutdown failed"
      );
    });
  }
  process.exitCode = 1;
}

if (server) {
  for (const signal of ["SIGINT", "SIGTERM"]) {
    process.on(signal, () => {
      logger.info({ signal }, "Shutting down backend");
      server.close((error) => {
        if (error) {
          logger.error({ err: error }, "Backend shutdown failed");
          process.exitCode = 1;
        }
        prisma.$disconnect().catch((disconnectError) => {
          logger.error(
            { errorCode: disconnectError.code || disconnectError.name },
            "Database shutdown failed"
          );
          process.exitCode = 1;
        });
      });
    });
  }

  server.on("error", (error) => {
    logger.error({ err: error }, "Backend failed to start");
    process.exitCode = 1;
  });
}
