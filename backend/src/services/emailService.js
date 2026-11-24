import nodemailer from "nodemailer";
import { env } from "../config/env.js";
import { ApiError } from "../utils/apiError.js";

function createTransporter() {
  if (!env.SMTP_HOST || !env.SMTP_PORT || !env.SMTP_FROM || !env.FRONTEND_BASE_URL) {
    throw new ApiError(
      503,
      "EMAIL_NOT_CONFIGURED",
      "Email delivery is not configured."
    );
  }
  if (Boolean(env.SMTP_USER) !== Boolean(env.SMTP_PASSWORD)) {
    throw new Error("SMTP_USER and SMTP_PASSWORD must either both be set or both be empty.");
  }

  return nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_PORT === 465,
    ...(env.SMTP_USER ? { auth: { user: env.SMTP_USER, pass: env.SMTP_PASSWORD } } : {}),
  });
}

export async function sendPasswordResetEmail({ email, name, token }) {
  const transporter = createTransporter();
  const resetUrl = new URL("/reset-password", env.FRONTEND_BASE_URL);
  resetUrl.searchParams.set("token", token);

  await transporter.sendMail({
    from: env.SMTP_FROM,
    to: email,
    subject: "Reset your Osan Lift account password",
    text: `Hello ${name},\n\nUse this link to reset your password. It expires in ${env.PASSWORD_RESET_TTL_MINUTES} minutes:\n${resetUrl}\n\nIf you did not request this, you can ignore this email.`,
  });
}

export async function sendEmailVerification({ email, name, token }) {
  const transporter = createTransporter();
  const verificationUrl = new URL("/verify-email", env.FRONTEND_BASE_URL);
  verificationUrl.searchParams.set("token", token);

  await transporter.sendMail({
    from: env.SMTP_FROM,
    to: email,
    subject: "Verify your Osan Lift account",
    text: `Hello ${name},\n\nUse this link to verify your email address. It is valid for 24 hours:\n${verificationUrl}\n\nIf you did not request this, you can ignore this email.`,
  });
}
