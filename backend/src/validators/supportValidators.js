import { z } from "zod";

const moneyInput = z.union([z.string().trim(), z.number().finite()])
  .transform(String)
  .refine((value) => /^\d{1,12}(?:\.\d{1,2})?$/.test(value), "Use a non-negative amount with up to two decimal places.");

const supportStatuses = ["OPEN", "IN_REVIEW", "QUOTED", "COMPLETE", "REJECTED"];

export const supportRequestCreateSchema = z.object({
  serviceId: z.string().trim().min(1).max(100),
  serviceTitle: z.string().trim().min(1).max(200),
  serviceTag: z.string().trim().max(100).optional(),
  whatsapp: z.string().trim().min(5).max(40),
  problemDetails: z.string().trim().min(1).max(5000),
  companyId: z.string().min(1).max(150).optional(),
}).strict();

export const supportListQuerySchema = z.object({
  status: z.enum(supportStatuses).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
}).strict();

export const supportIdParamsSchema = z.object({
  requestId: z.string().min(1).max(150),
}).strict();

export const supportStatusSchema = z.object({
  status: z.enum(supportStatuses),
}).strict();

export const supportAttachmentParamsSchema = z.object({
  requestId: z.string().min(1).max(150),
  attachmentId: z.string().min(1).max(150),
}).strict();

export const quotationCreateSchema = z.object({
  suggestion: z.string().trim().max(5000).optional(),
  validUntil: z.string().datetime({ offset: true }).optional(),
  status: z.enum(["DRAFT", "SENT"]).default("SENT"),
  items: z.array(z.object({
    name: z.string().trim().min(1).max(240),
    qty: z.union([z.string().trim(), z.number().finite()])
      .transform(String)
      .refine((value) => /^\d{1,9}(?:\.\d{1,3})?$/.test(value) && Number(value) > 0,
        "Quotation quantities must be positive and have up to three decimal places."),
    price: moneyInput,
  }).strict()).min(1).max(100),
}).strict();

export const quotationIdParamsSchema = z.object({
  quotationId: z.string().min(1).max(150),
}).strict();

export const quotationStatusSchema = z.object({
  status: z.enum(["SENT", "ACCEPTED", "REJECTED", "EXPIRED"]),
}).strict();
