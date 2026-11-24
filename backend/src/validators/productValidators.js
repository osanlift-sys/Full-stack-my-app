import { z } from "zod";

const moneyInput = z.union([z.string().trim(), z.number().finite()])
  .transform(String)
  .refine((value) => /^\d{1,12}(?:\.\d{1,2})?$/.test(value), "Use a non-negative amount with up to two decimal places.");

const quantityInput = z.union([z.string().trim(), z.number().finite()])
  .transform(String)
  .refine((value) => /^\d{1,9}(?:\.\d{1,3})?$/.test(value), "Use a quantity with up to three decimal places.");

const imageSchema = z.object({
  url: z.string().url().max(2048).refine((value) => new URL(value).protocol === "https:", "Product image URLs must use HTTPS."),
  mimeType: z.string().trim().max(100).optional(),
  sizeBytes: z.number().int().positive().max(10 * 1024 * 1024).optional(),
}).strict();

const productFields = {
  sku: z.string().trim().min(1).max(80).nullable().optional(),
  name: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().max(4000).nullable().optional(),
  categoryId: z.string().min(1).max(150).nullable().optional(),
  sellerId: z.string().min(1).max(150).nullable().optional(),
  unit: z.string().trim().max(40).nullable().optional(),
  unitPrice: moneyInput.optional(),
  sellingPrice: moneyInput.optional(),
  isPublic: z.boolean().optional(),
  images: z.array(imageSchema).max(10).optional(),
};

export const productCreateSchema = z.object({
  ...productFields,
  name: productFields.name,
  stockQuantity: quantityInput.optional(),
}).strict().refine((data) => Boolean(data.name), {
  message: "Product name is required.",
  path: ["name"],
});

export const productUpdateSchema = z.object({
  ...productFields,
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
}).strict().refine((data) => Object.keys(data).length > 0, "Provide at least one field to update.");

export const productListQuerySchema = z.object({
  search: z.string().trim().max(120).optional(),
  categoryId: z.string().min(1).max(150).optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
  isPublic: z.enum(["true", "false"]).transform((value) => value === "true").optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
}).strict();

export const productIdParamsSchema = z.object({
  productId: z.string().min(1).max(150),
}).strict();

export const stockAdjustmentSchema = z.object({
  direction: z.enum(["IN", "OUT"]),
  quantity: quantityInput.refine((value) => Number(value) > 0, "Stock adjustment quantity must be greater than zero."),
  reason: z.string().trim().min(1).max(200),
}).strict();

export const productCategoryCreateSchema = z.object({
  name: z.string().trim().min(1).max(100),
}).strict();
