import { z } from "zod";

const idParams = z.object({
  userId: z.string().min(1).max(150).optional(),
  employeeId: z.string().min(1).max(150).optional(),
  companyId: z.string().min(1).max(150).optional(),
  contactId: z.string().min(1).max(150).optional(),
}).strict();

export const userIdParamsSchema = idParams.pick({ userId: true }).required();
export const employeeIdParamsSchema = idParams.pick({ employeeId: true }).required();
export const companyIdParamsSchema = idParams.pick({ companyId: true }).required();
export const contactIdParamsSchema = idParams.pick({ contactId: true }).required();

export const userListQuerySchema = z.object({
  role: z.enum(["ADMIN", "EMPLOYEE", "CLIENT", "SELLER"]).optional(),
  status: z.enum(["PENDING", "ACTIVE", "REJECTED", "SUSPENDED"]).optional(),
  search: z.string().trim().max(120).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
}).strict();

export const employeeReviewSchema = z.object({
  decision: z.enum(["APPROVED", "REJECTED"]),
}).strict();

export const accountStatusSchema = z.object({
  status: z.enum(["ACTIVE", "REJECTED", "SUSPENDED"]),
  companyId: z.string().min(1).max(150).optional(),
}).strict();

export const userRoleSchema = z.object({
  role: z.enum(["ADMIN", "EMPLOYEE", "CLIENT", "SELLER"]),
}).strict();

export const sellerCommissionSchema = z.object({
  commissionRate: z.union([z.string().trim(), z.number().finite()])
    .transform(String)
    .refine((value) => /^(?:\d{1,3})(?:\.\d{1,4})?$/.test(value) && Number(value) <= 100,
      "Commission rate must be between 0 and 100 percent, with up to four decimal places."),
}).strict();

export const sellerIdParamsSchema = z.object({
  sellerId: z.string().min(1).max(150),
}).strict();

export const userPermissionsSchema = z.object({
  permissions: z.record(
    z.string().regex(/^[a-z][a-z0-9_]{0,62}$/),
    z.boolean()
  ).refine((permissions) => Object.keys(permissions).length <= 100),
}).strict();

export const companyCreateSchema = z.object({
  name: z.string().trim().min(1).max(200),
  address: z.string().trim().max(500).optional(),
  phone: z.string().trim().max(40).optional(),
  email: z.string().trim().email().max(254).optional(),
}).strict();

export const clientContactCreateSchema = z.object({
  email: z.string().trim().email().max(254),
  name: z.string().trim().min(1).max(120).optional(),
}).strict();

export const clientContactStatusSchema = z.object({
  status: z.enum(["ACTIVE", "INACTIVE"]),
}).strict();
