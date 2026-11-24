import { z } from "zod";

const emailSchema = z.string().trim().email().max(254).transform((email) => email.toLowerCase());
const passwordSchema = z.string().min(12).max(128);
const nameSchema = z.string().trim().min(1).max(120);

export const employeeRegistrationSchema = z.object({
  email: emailSchema,
  name: nameSchema,
  password: passwordSchema,
}).strict();

export const clientRegistrationSchema = z.object({
  email: emailSchema,
  name: nameSchema,
  password: passwordSchema,
  companyName: z.string().trim().min(1).max(200),
}).strict();

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(128),
}).strict();

export const googleLoginSchema = z.object({
  idToken: z.string().min(1).max(8192),
}).strict();

export const passwordResetRequestSchema = z.object({
  email: emailSchema,
}).strict();

export const emailVerificationRequestSchema = z.object({
  email: emailSchema,
}).strict();

export const emailVerificationCompleteSchema = z.object({
  token: z.string().min(32).max(200),
}).strict();

export const passwordResetCompleteSchema = z.object({
  token: z.string().min(32).max(200),
  password: passwordSchema,
}).strict();

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: passwordSchema,
}).strict();

export const profileUpdateSchema = z.object({
  name: nameSchema.optional(),
  photoUrl: z.string().url().refine((value) => value.startsWith("https://")).nullable().optional(),
  designation: z.string().trim().max(120).nullable().optional(),
  phone: z.string().trim().max(40).nullable().optional(),
  address: z.string().trim().max(500).nullable().optional(),
}).strict().refine((data) => Object.keys(data).length > 0);
