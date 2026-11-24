import { randomBytes } from "node:crypto";
import { randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import bcrypt from "bcrypt";
import { OAuth2Client } from "google-auth-library";
import prisma from "../config/database.js";
import { env } from "../config/env.js";
import { logger } from "../utils/logger.js";
import { ApiError } from "../utils/apiError.js";
import {
  authCookieNames,
  clearAuthCookies,
  createRefreshToken,
  hashOpaqueToken,
  setAuthCookies,
} from "../utils/authTokens.js";
import { normalizeEmail, toPublicUser } from "../utils/identity.js";
import { sendEmailVerification, sendPasswordResetEmail } from "./emailService.js";
import { sniffFileType } from "./supportFiles.js";

const passwordHashCost = 12;
const googleClient = new OAuth2Client();
const uploadsDirectory = fileURLToPath(new URL("../../uploads/", import.meta.url));

function assertActiveUser(user) {
  if (user.status !== "ACTIVE") {
    throw new ApiError(403, "ACCOUNT_NOT_ACTIVE", "This account is not active.");
  }
}

async function saveAudit(tx, { user, email, action, resourceId }) {
  await tx.auditLog.create({
    data: {
      actorId: user?.id,
      actorEmail: user?.email || email,
      action,
      resourceType: "USER",
      resourceId: resourceId || user?.id,
      metadata: {},
    },
  });
}

async function startSession(user, res) {
  const refreshToken = createRefreshToken();
  const expiresAt = new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);

  const session = await prisma.$transaction(async (tx) => {
    const created = await tx.refreshToken.create({
      data: { userId: user.id, tokenHash: hashOpaqueToken(refreshToken), expiresAt },
    });
    await tx.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });
    await saveAudit(tx, { user, action: "AUTHENTICATED" });
    return created;
  });

  const csrfToken = setAuthCookies(res, user.id, session.id, refreshToken);
  return { user: toPublicUser(user), csrfToken };
}

async function issueEmailVerification(user) {
  const rawToken = randomBytes(32).toString("base64url");
  const verification = await prisma.emailVerificationToken.create({
    data: {
      userId: user.id,
      tokenHash: hashOpaqueToken(rawToken),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
  });

  try {
    await sendEmailVerification({ email: user.email, name: user.name, token: rawToken });
  } catch (error) {
    await prisma.emailVerificationToken.update({
      where: { id: verification.id },
      data: { usedAt: new Date() },
    });
    logger.error({ err: error, userId: user.id }, "Email verification delivery failed");
    throw error;
  }
}

export async function registerEmployee({ email, name, password }, res) {
  const normalizedEmail = normalizeEmail(email);
  const passwordHash = await bcrypt.hash(password, passwordHashCost);
  const ownerEmail = env.BOOTSTRAP_ADMIN_EMAIL
    ? normalizeEmail(env.BOOTSTRAP_ADMIN_EMAIL)
    : null;

  if (ownerEmail && normalizedEmail === ownerEmail) {
    const existing = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      include: {
        employee: { select: { id: true } },
        permissions: { select: { key: true, enabled: true } },
      },
    });

    const user = await prisma.$transaction(async (tx) => {
      const owner = existing
        ? await tx.user.update({
            where: { id: existing.id },
            data: {
              name,
              passwordHash,
              role: "ADMIN",
              status: "ACTIVE",
              emailVerifiedAt: existing.emailVerifiedAt || new Date(),
            },
            include: {
              employee: { select: { id: true } },
              permissions: { select: { key: true, enabled: true } },
            },
          })
        : await tx.user.create({
            data: {
              email: normalizedEmail,
              name,
              passwordHash,
              role: "ADMIN",
              status: "ACTIVE",
              emailVerifiedAt: new Date(),
            },
            include: {
              employee: { select: { id: true } },
              permissions: { select: { key: true, enabled: true } },
            },
          });

      await saveAudit(tx, {
        user: owner,
        action: existing ? "OWNER_ACCOUNT_SIGNUP" : "OWNER_ACCOUNT_CREATED",
      });
      return owner;
    });

    const session = await startSession(user, res);
    return {
      ...session,
      directLogin: true,
      message: "Owner account created and logged in.",
    };
  }

  const existingUser = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });
  if (existingUser) {
    throw new ApiError(
      409,
      "EMAIL_ALREADY_REGISTERED",
      "An account with this email address already exists."
    );
  }

  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        email: normalizedEmail,
        name,
        passwordHash,
        role: "EMPLOYEE",
        status: "PENDING",
        employee: { create: { approvalStatus: "PENDING" } },
      },
    });
    await saveAudit(tx, {
      user: created,
      action: "EMPLOYEE_REGISTRATION_REQUESTED",
    });
    return created;
  });
  await issueEmailVerification(user);

  return {
    message: "Verify your email address. An administrator must then approve your account.",
    user: toPublicUser(user),
  };
}

export async function registerClient({ email, name, password, companyName }) {
  const normalizedEmail = normalizeEmail(email);
  const existingUser = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });
  if (existingUser) {
    throw new ApiError(
      409,
      "EMAIL_ALREADY_REGISTERED",
      "An account with this email address already exists."
    );
  }

  const passwordHash = await bcrypt.hash(password, passwordHashCost);
  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        email: normalizedEmail,
        name,
        passwordHash,
        role: "CLIENT",
        status: "PENDING",
        requestedCompanyName: companyName.trim().replace(/\s+/g, " "),
      },
    });
    await saveAudit(tx, { user: created, action: "CLIENT_REGISTRATION_REQUESTED" });
    return created;
  });

  await issueEmailVerification(user);
  return {
    user: toPublicUser(user),
    message: "Verify your email address. An administrator will review your client account request.",
  };
}

export async function login({ email, password }, res) {
  const user = await prisma.user.findUnique({
    where: { email: normalizeEmail(email) },
    include: {
      employee: { select: { id: true } },
      permissions: { select: { key: true, enabled: true } },
    },
  });
  if (!user?.passwordHash || !(await bcrypt.compare(password, user.passwordHash))) {
    throw new ApiError(401, "INVALID_CREDENTIALS", "Email or password is incorrect.");
  }
  assertActiveUser(user);
  return startSession(user, res);
}

export async function loginWithGoogle(idToken, res) {
  if (!env.GOOGLE_CLIENT_ID) {
    throw new ApiError(503, "GOOGLE_SIGN_IN_UNAVAILABLE", "Google sign-in is not configured.");
  }

  let googleProfile;
  try {
    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: env.GOOGLE_CLIENT_ID,
    });
    googleProfile = ticket.getPayload();
  } catch {
    throw new ApiError(401, "INVALID_GOOGLE_CREDENTIAL", "Google sign-in could not be verified.");
  }

  if (!googleProfile?.email || googleProfile.email_verified !== true || !googleProfile.sub) {
    throw new ApiError(401, "INVALID_GOOGLE_CREDENTIAL", "A verified Google account is required.");
  }

  const email = normalizeEmail(googleProfile.email);
  let user = await prisma.user.findUnique({ where: { email } });

  if (user) {
    if (user.googleSubject && user.googleSubject !== googleProfile.sub) {
      throw new ApiError(409, "GOOGLE_ACCOUNT_MISMATCH", "This email is linked to a different Google account.");
    }
    user = await prisma.user.update({
      where: { id: user.id },
      data: {
        googleSubject: googleProfile.sub,
        emailVerifiedAt: user.emailVerifiedAt || new Date(),
      },
      include: {
        employee: { select: { id: true } },
        permissions: { select: { key: true, enabled: true } },
      },
    });
    assertActiveUser(user);
  } else {
    user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          email,
          name: googleProfile.name || email,
          googleSubject: googleProfile.sub,
          photoUrl: googleProfile.picture || null,
          emailVerifiedAt: new Date(),
          role: "CLIENT",
          status: "PENDING",
        },
      });
      await saveAudit(tx, { user: created, action: "CLIENT_GOOGLE_REGISTRATION_REQUESTED" });
      return created;
    });
    return {
      pendingApproval: true,
      message: "Your Google email is verified. An administrator must approve your client account before you can sign in.",
    };
  }

  return startSession(user, res);
}

export async function refreshSession(req, res) {
  const refreshToken = req.cookies?.[authCookieNames.refresh];
  if (!refreshToken) {
    throw new ApiError(401, "UNAUTHENTICATED", "Please sign in to continue.");
  }

  const existing = await prisma.refreshToken.findUnique({
    where: { tokenHash: hashOpaqueToken(refreshToken) },
    include: { user: true },
  });
  if (
    !existing ||
    existing.revokedAt ||
    existing.expiresAt <= new Date() ||
    existing.user.status !== "ACTIVE"
  ) {
    clearAuthCookies(res);
    throw new ApiError(401, "UNAUTHENTICATED", "Please sign in to continue.");
  }

  const nextToken = createRefreshToken();
  const now = new Date();
  const nextExpiresAt = new Date(now.getTime() + env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);
  const session = await prisma.$transaction(async (tx) => {
    const revoked = await tx.refreshToken.updateMany({
      where: { id: existing.id, revokedAt: null, expiresAt: { gt: now } },
      data: { revokedAt: now },
    });
    if (revoked.count !== 1) {
      throw new ApiError(401, "UNAUTHENTICATED", "Please sign in to continue.");
    }
    const created = await tx.refreshToken.create({
      data: {
        userId: existing.userId,
        tokenHash: hashOpaqueToken(nextToken),
        expiresAt: nextExpiresAt,
      },
    });
    await saveAudit(tx, { user: existing.user, action: "REFRESH_TOKEN_ROTATED" });
    return created;
  });

  const csrfToken = setAuthCookies(res, existing.userId, session.id, nextToken);
  return { user: toPublicUser(existing.user), csrfToken };
}

export async function logout(req, res) {
  const refreshToken = req.cookies?.[authCookieNames.refresh];
  if (refreshToken) {
    const tokenHash = hashOpaqueToken(refreshToken);
    const session = await prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });
    if (session && !session.revokedAt) {
      await prisma.$transaction(async (tx) => {
        await tx.refreshToken.update({
          where: { id: session.id },
          data: { revokedAt: new Date() },
        });
        await saveAudit(tx, { user: session.user, action: "LOGGED_OUT" });
      });
    }
  }

  clearAuthCookies(res);
}

export async function requestPasswordReset(email) {
  const user = await prisma.user.findUnique({
    where: { email: normalizeEmail(email) },
  });

  if (user?.status === "ACTIVE") {
    const rawToken = randomBytes(32).toString("base64url");
    const expiresAt = new Date(Date.now() + env.PASSWORD_RESET_TTL_MINUTES * 60 * 1000);
    const resetToken = await prisma.$transaction(async (tx) => {
      await tx.passwordResetToken.updateMany({
        where: { userId: user.id, usedAt: null },
        data: { usedAt: new Date() },
      });
      return tx.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash: hashOpaqueToken(rawToken),
          expiresAt,
        },
      });
    });

    try {
      await sendPasswordResetEmail({ email: user.email, name: user.name, token: rawToken });
    } catch (error) {
      await prisma.passwordResetToken.update({
        where: { id: resetToken.id },
        data: { usedAt: new Date() },
      });
      logger.error({ err: error, userId: user.id }, "Password reset email delivery failed");
      throw error;
    }

    await prisma.auditLog.create({
      data: {
        actorId: user.id,
        actorEmail: user.email,
        action: "PASSWORD_RESET_REQUESTED",
        resourceType: "USER",
        resourceId: user.id,
        metadata: {},
      },
    });
  }

  return { message: "If an active account exists for this email, password reset instructions will be sent." };
}

export async function requestEmailVerification(email) {
  const user = await prisma.user.findUnique({
    where: { email: normalizeEmail(email) },
  });

  if (user?.status === "PENDING" && !user.emailVerifiedAt) {
    await issueEmailVerification(user);
  }

  return { message: "If email verification is available for this account, instructions will be sent." };
}

export async function completeEmailVerification(token) {
  const verification = await prisma.emailVerificationToken.findUnique({
    where: { tokenHash: hashOpaqueToken(token) },
    include: { user: { include: { employee: true } } },
  });
  const now = new Date();
  if (!verification) {
    throw new ApiError(400, "INVALID_VERIFICATION_TOKEN", "This verification link is invalid or expired.");
  }
  if (verification.usedAt && verification.user.emailVerifiedAt) return;
  if (verification.usedAt || verification.expiresAt <= now) {
    throw new ApiError(400, "INVALID_VERIFICATION_TOKEN", "This verification link is invalid or expired.");
  }

  const { user } = verification;
  let status = user.status;
  if (user.role === "EMPLOYEE") {
    if (user.employee?.approvalStatus === "REJECTED") status = "REJECTED";
    else if (user.employee?.approvalStatus === "APPROVED") status = "ACTIVE";
  }

  await prisma.$transaction(async (tx) => {
    const consumed = await tx.emailVerificationToken.updateMany({
      where: { id: verification.id, usedAt: null, expiresAt: { gt: now } },
      data: { usedAt: now },
    });
    if (consumed.count !== 1) {
      const currentVerification = await tx.emailVerificationToken.findUnique({
        where: { id: verification.id },
        include: { user: { select: { emailVerifiedAt: true } } },
      });
      if (currentVerification?.usedAt && currentVerification.user.emailVerifiedAt) return;
      throw new ApiError(400, "INVALID_VERIFICATION_TOKEN", "This verification link is invalid or expired.");
    }
    await tx.user.update({
      where: { id: user.id },
      data: { emailVerifiedAt: now, status },
    });
    await tx.emailVerificationToken.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: now },
    });
    await saveAudit(tx, { user, action: "EMAIL_VERIFIED" });
  });
}

export async function completePasswordReset({ token, password }) {
  const tokenHash = hashOpaqueToken(token);
  const reset = await prisma.passwordResetToken.findUnique({
    where: { tokenHash },
    include: { user: true },
  });
  const now = new Date();
  if (!reset || reset.usedAt || reset.expiresAt <= now || reset.user.status !== "ACTIVE") {
    throw new ApiError(400, "INVALID_RESET_TOKEN", "This password reset link is invalid or expired.");
  }

  const passwordHash = await bcrypt.hash(password, passwordHashCost);
  await prisma.$transaction(async (tx) => {
    const consumed = await tx.passwordResetToken.updateMany({
      where: { id: reset.id, usedAt: null, expiresAt: { gt: now } },
      data: { usedAt: now },
    });
    if (consumed.count !== 1) {
      throw new ApiError(400, "INVALID_RESET_TOKEN", "This password reset link is invalid or expired.");
    }
    await tx.user.update({
      where: { id: reset.userId },
      data: { passwordHash },
    });
    await tx.refreshToken.updateMany({
      where: { userId: reset.userId, revokedAt: null },
      data: { revokedAt: now },
    });
    await tx.passwordResetToken.updateMany({
      where: { userId: reset.userId, usedAt: null },
      data: { usedAt: now },
    });
    await saveAudit(tx, {
      user: reset.user,
      action: "PASSWORD_RESET_COMPLETED",
    });
  });
}

export async function changePassword(userId, { currentPassword, newPassword }, res) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user?.passwordHash) {
    throw new ApiError(409, "PASSWORD_NOT_SET", "This account does not have a password set.");
  }
  if (!(await bcrypt.compare(currentPassword, user.passwordHash))) {
    throw new ApiError(400, "INVALID_CURRENT_PASSWORD", "Current password is incorrect.");
  }

  const passwordHash = await bcrypt.hash(newPassword, passwordHashCost);
  const now = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: userId }, data: { passwordHash } });
    await tx.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: now },
    });
    await saveAudit(tx, { user, action: "PASSWORD_CHANGED" });
  });
  clearAuthCookies(res);
}

export async function getProfile(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      employee: { select: { id: true, designation: true, phone: true, address: true } },
      permissions: { select: { key: true, enabled: true } },
      clientMemberships: {
        select: {
          company: {
            select: { id: true, name: true, address: true, phone: true, email: true, status: true },
          },
        },
      },
    },
  });
  if (!user) throw new ApiError(404, "USER_NOT_FOUND", "User not found.");
  return toPublicUser(user);
}

export async function updateProfile(userId, data) {
  const user = await prisma.$transaction(async (tx) => {
    const existing = await tx.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true },
    });
    if (!existing) throw new ApiError(404, "USER_NOT_FOUND", "User not found.");
    const employeeFields = ["designation", "phone", "address"];
    if (existing.role !== "EMPLOYEE" && employeeFields.some((field) => data[field] !== undefined)) {
      throw new ApiError(400, "EMPLOYEE_PROFILE_FIELDS_ONLY", "Only employees can update employee profile fields.");
    }
    const updated = await tx.user.update({
      where: { id: userId },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.photoUrl !== undefined ? { photoUrl: data.photoUrl } : {}),
      },
    });
    let employee;
    if (existing.role === "EMPLOYEE") {
      employee = await tx.employeeProfile.update({
        where: { userId },
        data: {
          ...(data.designation !== undefined ? { designation: data.designation } : {}),
          ...(data.phone !== undefined ? { phone: data.phone } : {}),
          ...(data.address !== undefined ? { address: data.address } : {}),
        },
        select: { id: true, designation: true, phone: true, address: true },
      });
    }
    await saveAudit(tx, { user: updated, action: "PROFILE_UPDATED" });
    return { ...updated, employee };
  });
  return toPublicUser(user);
}

export async function updateProfilePhoto(userId, file) {
  if (!file) {
    throw new ApiError(400, "PROFILE_PHOTO_REQUIRED", "Choose a profile photo to upload.");
  }

  const detected = sniffFileType(file.buffer);
  if (detected.mimeType === "application/pdf") {
    throw new ApiError(400, "UNSUPPORTED_PROFILE_PHOTO", "Only JPEG, PNG, and WebP images are accepted.");
  }
  if (!["image/jpeg", "image/png", "image/webp"].includes(detected.mimeType)) {
    throw new ApiError(400, "UNSUPPORTED_PROFILE_PHOTO", "Only JPEG, PNG, and WebP images are accepted.");
  }

  const profileDirectory = path.join(uploadsDirectory, "profile");
  await mkdir(profileDirectory, { recursive: true });
  const storageName = `${randomUUID()}.${detected.extension}`;
  await writeFile(path.join(profileDirectory, storageName), file.buffer, { mode: 0o600 });

  const photoUrl = `/uploads/profile/${storageName}`;
  const user = await prisma.$transaction(async (tx) => {
    const existing = await tx.user.findUnique({
      where: { id: userId },
      select: { photoUrl: true },
    });
    if (!existing) throw new ApiError(404, "USER_NOT_FOUND", "User not found.");

    const updated = await tx.user.update({
      where: { id: userId },
      data: { photoUrl },
      include: {
        employee: { select: { id: true, designation: true, phone: true, address: true } },
        permissions: { select: { key: true, enabled: true } },
      },
    });
    await saveAudit(tx, { user: updated, action: "PROFILE_PHOTO_UPDATED" });

    if (existing.photoUrl?.startsWith("/uploads/profile/")) {
      const oldName = path.basename(existing.photoUrl);
      await unlink(path.join(profileDirectory, oldName)).catch(() => {});
    }
    return updated;
  });

  return toPublicUser(user);
}
