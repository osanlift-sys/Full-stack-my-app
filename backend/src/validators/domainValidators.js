import { z } from "zod";

const id = z.string().trim().min(1).max(150);
const pagination = {
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
};
const quantity = z.union([z.string().trim(), z.number().finite()])
  .transform(String)
  .refine((value) => /^\d{1,9}(?:\.\d{1,3})?$/.test(value) && Number(value) > 0);
const amount = z.union([z.string().trim(), z.number().finite()])
  .transform(String)
  .refine((value) => /^\d{1,12}(?:\.\d{1,2})?$/.test(value) && Number(value) >= 0);
const isoDate = z.string().date();
const dateRange = {
  from: isoDate.optional(),
  to: isoDate.optional(),
};
const dateRangeValid = (value) => !value.from || !value.to || value.from <= value.to;
export const pageQuerySchema = z.object(pagination).strict();

export const attendanceQuerySchema = z.object({
  ...dateRange,
  employeeId: id.optional(),
  status: z.enum(["PRESENT", "ABSENT", "LEAVE"]).optional(),
  ...pagination,
}).strict().refine(dateRangeValid, "The start date must not be after the end date.");

export const attendanceCreateSchema = z.object({
  employeeId: id,
  date: isoDate,
  status: z.enum(["PRESENT", "ABSENT", "LEAVE"]).optional(),
  statusIn: z.string().trim().max(80).optional(),
  statusOut: z.string().trim().max(80).optional(),
  advanceDeduction: amount.optional(),
  notes: z.string().trim().max(2000).optional(),
}).strict();

export const attendanceUpdateSchema = attendanceCreateSchema.omit({ employeeId: true })
  .partial().refine((data) => Object.keys(data).length > 0, "Provide at least one field to update.");

export const attendanceRequestSchema = z.object({
  requestedDate: isoDate,
  requestData: z.record(z.string(), z.unknown()).default({}),
}).strict();

export const attendanceReviewSchema = z.object({
  status: z.enum(["APPROVED", "REJECTED"]),
}).strict();

export const payrollQuerySchema = z.object({
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
  employeeId: id.optional(),
  ...pagination,
}).strict();
export const salaryUpdateSchema = z.object({
  baseSalary: amount,
  advanceDeduction: amount,
}).strict();
export const employeeParamsSchema = z.object({ employeeId: id }).strict();

export const challanQuerySchema = z.object({
  search: z.string().trim().max(120).optional(),
  ...dateRange,
  ...pagination,
}).strict().refine(dateRangeValid, "The start date must not be after the end date.");

const challanItemSchema = z.object({
  description: z.string().trim().min(1).max(500),
  quantity,
  unit: z.string().trim().max(40).optional(),
}).strict();
export const challanCreateSchema = z.object({
  challanNo: z.string().trim().max(100).optional(),
  companyName: z.string().trim().max(200).optional(),
  address: z.string().trim().max(1000).optional(),
  subject: z.string().trim().max(300).optional(),
  challanDate: isoDate.optional(),
  items: z.array(challanItemSchema).min(1).max(100),
}).strict();
export const challanUpdateSchema = challanCreateSchema.partial()
  .refine((data) => Object.keys(data).length > 0, "Provide at least one field to update.");
export const idParamsSchema = z.object({ id }).strict();
export const projectParamsSchema = z.object({ projectId: id }).strict();
export const serviceRecordParamsSchema = z.object({ projectId: id, recordId: id }).strict();
export const checklistParamsSchema = z.object({ projectId: id, checklistId: id }).strict();

export const projectQuerySchema = z.object({
  search: z.string().trim().max(120).optional(),
  status: z.string().trim().max(80).optional(),
  companyId: id.optional(),
  ...pagination,
}).strict();
export const projectCreateSchema = z.object({
  companyId: id.nullable().optional(),
  projectName: z.string().trim().min(1).max(200),
  status: z.string().trim().max(80).optional(),
  liftQuantity: z.number().int().min(0).max(10000).optional(),
  servicingDate: isoDate.nullable().optional(),
  legacyData: z.record(z.string(), z.unknown()).optional(),
}).strict();
export const projectUpdateSchema = projectCreateSchema.partial()
  .refine((data) => Object.keys(data).length > 0, "Provide at least one field to update.");

const serviceRecordFields = {
  month: z.string().trim().max(80).optional(),
  servicingDate: isoDate.nullable().optional(),
  servicingStatus: z.string().trim().max(100).optional(),
  advanceDeduction: amount.nullable().optional(),
  legacyData: z.record(z.string(), z.unknown()).optional(),
};
export const serviceRecordCreateSchema = z.object(serviceRecordFields).strict()
  .refine((data) => Object.keys(data).length > 0, "Provide at least one service schedule field.");
export const serviceRecordUpdateSchema = serviceRecordCreateSchema;

export const incomeQuerySchema = z.object({
  type: z.enum(["INSTALLATION", "CONVEYANCE", "ALLOWANCE", "OTHER"]).optional(),
  ...dateRange,
  ...pagination,
}).strict().refine(dateRangeValid, "The start date must not be after the end date.");
export const incomeCreateSchema = z.object({
  type: z.enum(["INSTALLATION", "CONVEYANCE", "ALLOWANCE", "OTHER"]),
  category: z.string().trim().max(100).optional(),
  amount,
  occurredAt: z.string().datetime().optional(),
  details: z.record(z.string(), z.unknown()).default({}),
}).strict();
export const incomeUpdateSchema = incomeCreateSchema.partial()
  .refine((data) => Object.keys(data).length > 0, "Provide at least one field to update.");

export const notificationQuerySchema = z.object({
  unreadOnly: z.enum(["true", "false"]).transform((value) => value === "true").default("false"),
  ...pagination,
}).strict();
export const notificationCreateSchema = z.object({
  userId: id,
  title: z.string().trim().min(1).max(200),
  message: z.string().trim().min(1).max(4000),
  payload: z.record(z.string(), z.unknown()).default({}),
}).strict();

export const checklistSaveSchema = z.object({
  checklist: z.unknown(),
}).strict();
export const checklistGenerateSchema = z.object({
  workDescription: z.string().trim().max(4000).optional(),
}).strict();
export const checklistTaskUpdateSchema = z.object({
  taskId: id,
  status: z.enum(["Pending", "In Progress", "Complete"]),
  technicianNotes: z.string().max(1000),
}).strict();
export const purchaseQuerySchema = z.object({
  ...dateRange,
  ...pagination,
}).strict().refine(dateRangeValid, "The start date must not be after the end date.");
export const purchaseCreateSchema = z.object({
  purchasedAt: z.string().datetime().optional(),
  date: isoDate.optional(),
  items: z.array(z.object({
    productId: id,
    quantity,
  }).strict()).min(1).max(100),
}).strict().refine((data) => !(data.purchasedAt && data.date), {
  message: "Provide either purchasedAt or date, not both.",
  path: ["purchasedAt"],
});
