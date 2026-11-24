import { z } from "zod";

const moneyInput = z.union([z.string().trim(), z.number().finite()])
  .transform(String)
  .refine((value) => /^\d{1,12}(?:\.\d{1,2})?$/.test(value), "Use a non-negative amount with up to two decimal places.");

const quantityInput = z.union([z.string().trim(), z.number().finite()])
  .transform(String)
  .refine((value) => /^\d{1,9}(?:\.\d{1,3})?$/.test(value), "Use a quantity with up to three decimal places.")
  .refine((value) => Number(value) > 0, "Offer item quantities must be greater than zero.");

const offerItemSchema = z.object({
  productId: z.string().min(1).max(150).optional(),
  name: z.string().trim().min(1).max(240),
  quantity: quantityInput,
  unit: z.string().trim().max(40).optional(),
  price: moneyInput,
}).passthrough();

const headerDataSchema = z.object({
  toCompany: z.string().trim().min(1).max(200),
  address: z.string().trim().max(1000).optional(),
  subject: z.string().trim().max(240).optional(),
  date: z.string().trim().max(80).optional(),
}).passthrough();

const offerFields = {
  companyId: z.string().min(1).max(150).optional(),
  companyName: z.string().trim().min(1).max(200).optional(),
  headerData: headerDataSchema,
  items: z.array(offerItemSchema).min(1).max(200),
  notes: z.array(z.string().max(500)).max(50).optional(),
  paymentMode: z.union([
    z.array(z.string().max(200)).max(30),
    z.record(z.string(), z.unknown()),
  ]).optional(),
  discountAmount: moneyInput.optional(),
  subtotal: moneyInput.optional(),
  grandTotal: moneyInput.optional(),
};

export const offerCreateSchema = z.object(offerFields)
  .strict()
  .refine((data) => Boolean(data.companyId || data.companyName || data.headerData.toCompany), {
    message: "A company must be specified.",
    path: ["companyName"],
  });

export const offerUpdateSchema = z.object(offerFields)
  .partial()
  .strict()
  .refine((data) => Object.keys(data).length > 0, "Provide at least one field to update.");

export const offerIdParamsSchema = z.object({
  offerId: z.string().min(1).max(150),
}).strict();

export const offerListQuerySchema = z.object({
  companyId: z.string().min(1).max(150).optional(),
  search: z.string().trim().max(120).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
}).strict();

export const offerProductQuerySchema = z.object({
  search: z.string().trim().max(120).optional(),
}).strict();
