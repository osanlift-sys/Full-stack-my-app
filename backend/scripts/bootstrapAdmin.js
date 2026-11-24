import bcrypt from "bcrypt";
import { z } from "zod";
import prisma from "../src/config/database.js";
import { normalizeEmail } from "../src/utils/identity.js";

const inputSchema = z.object({
  BOOTSTRAP_ADMIN_EMAIL: z.string().email().max(254),
  BOOTSTRAP_ADMIN_PASSWORD: z.string().min(12).max(128),
  BOOTSTRAP_ADMIN_NAME: z.string().trim().min(1).max(120),
});

async function bootstrapAdmin() {
  const { BOOTSTRAP_ADMIN_EMAIL, BOOTSTRAP_ADMIN_PASSWORD, BOOTSTRAP_ADMIN_NAME } =
    inputSchema.parse(process.env);
  const email = normalizeEmail(BOOTSTRAP_ADMIN_EMAIL);
  const passwordHash = await bcrypt.hash(BOOTSTRAP_ADMIN_PASSWORD, 12);

  const admin = await prisma.$transaction(async (tx) => {
    const existing = await tx.user.findUnique({ where: { email } });
    const adminCount = await tx.user.count({ where: { role: "ADMIN" } });

    if (adminCount > 0) {
      if (existing?.role === "ADMIN") return { user: existing, created: false };
      throw new Error("An administrator already exists; bootstrap will not create another.");
    }

    const user = existing
      ? await tx.user.update({
        where: { id: existing.id },
        data: {
          name: BOOTSTRAP_ADMIN_NAME,
          passwordHash,
          emailVerifiedAt: existing.emailVerifiedAt || new Date(),
          role: "ADMIN",
          status: "ACTIVE",
        },
      })
      : await tx.user.create({
        data: {
          email,
          name: BOOTSTRAP_ADMIN_NAME,
          passwordHash,
          emailVerifiedAt: new Date(),
          role: "ADMIN",
          status: "ACTIVE",
        },
      });

    await tx.auditLog.create({
      data: {
        actorId: user.id,
        actorEmail: user.email,
        action: "INITIAL_ADMIN_BOOTSTRAPPED",
        resourceType: "USER",
        resourceId: user.id,
        metadata: {},
      },
    });
    return { user, created: true };
  });

  if (admin.created) {
    console.info(`Administrator account is ready for ${admin.user.email}.`);
  } else {
    console.info(`Administrator ${admin.user.email} already exists; no changes were made.`);
  }
}

try {
  await prisma.$connect();
  await bootstrapAdmin();
} catch (error) {
  console.error(error.message || "Administrator bootstrap failed.");
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
