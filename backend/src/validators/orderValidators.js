import { z } from "zod";

const quantityInput = z.union([z.string().trim(), z.number().finite()])
  .transform(String)
  .refine((value) => /^\d{1,9}(?:\.\d{1,3})?$/.test(value) && Number(value) > 0,
    "Use a positive quantity with up to three decimal places.");

export const checkoutSchema = z.object({
  companyId: z.string().min(1).max(150),
  items: z.array(z.object({
    productId: z.string().min(1).max(150),
    quantity: quantityInput,
  }).strict()).min(1).max(50),
}).strict();

export const orderIdParamsSchema = z.object({
  orderId: z.string().min(1).max(150),
}).strict();

export const orderListQuerySchema = z.object({
  status: z.enum(["PENDING", "CONFIRMED", "PROCESSING", "SHIPPED", "COMPLETED", "CANCELLED"]).optional(),
  paymentStatus: z.enum(["PENDING", "PARTIALLY_PAID", "PAID", "FAILED", "REFUNDED"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
}).strict();

export const orderStatusSchema = z.object({
  status: z.enum(["CONFIRMED", "PROCESSING", "SHIPPED", "COMPLETED", "CANCELLED"]),
}).strict();

export const orderPaymentSchema = z.object({
  amount: z.union([z.string().trim(), z.number().finite()])
    .transform(String)
    .refine((value) => /^\d{1,12}(?:\.\d{1,2})?$/.test(value) && Number(value) > 0,
      "Use a positive payment amount with up to two decimal places."),
  paymentMethod: z.string().trim().min(1).max(80),
  reference: z.string().trim().max(160).optional(),
  paidAt: z.string().datetime({ offset: true }).optional(),
}).strict();
