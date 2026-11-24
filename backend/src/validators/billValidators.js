import { z } from "zod";

const moneyInput = z.union([z.string().trim(), z.number().finite()])
  .transform((value) => String(value))
  .refine((value) => /^\d{1,12}(?:\.\d{1,2})?$/.test(value), "Use a non-negative amount with up to two decimal places.");

const quantityInput = z.union([z.string().trim(), z.number().finite()])
  .transform((value) => String(value))
  .refine((value) => /^\d{1,9}(?:\.\d{1,3})?$/.test(value), "Use a quantity with up to three decimal places.");

const billItemSchema = z.object({
  productId: z.string().min(1).max(150).optional(),
  name: z.string().trim().min(1).max(240),
  quantity: quantityInput,
  unit: z.string().trim().max(40).optional(),
  price: moneyInput,
}).strict();

const billFields = {
  companyId: z.string().min(1).max(150).optional(),
  companyDocId: z.string().min(1).max(150).optional(),
  companyName: z.string().trim().min(1).max(200).optional(),
  billNo: z.string().trim().min(1).max(80).optional(),
  subject: z.string().trim().max(240).optional(),
  address: z.string().trim().max(1000).optional(),
  toCompany: z.string().trim().max(200).optional(),
  purchaseOrderNo: z.string().trim().max(100).optional(),
  date: z.string().trim().min(1).max(40).optional(),
  dueDate: z.string().trim().min(1).max(40).optional(),
  items: z.array(billItemSchema).min(1).max(200).optional(),
  discountAmount: moneyInput.optional(),
  paidAmount: moneyInput.optional(),
  subtotal: moneyInput.optional(),
  grandTotal: moneyInput.optional(),
  dueAmount: moneyInput.optional(),
  createdType: z.enum(["General", "offer_based"]).optional(),
  offerId: z.string().max(150).nullable().optional(),
  isBlankCreated: z.boolean().optional(),
  showPaidAmount: z.boolean().optional(),
  showDueAmount: z.boolean().optional(),
  showPaymentMode: z.boolean().optional(),
  notes: z.array(z.string().max(500)).max(50).optional(),
  paymentMode: z.union([
    z.array(z.string().max(200)).max(30),
    z.record(z.string(), z.unknown()),
  ]).optional(),
  createdAt: z.string().max(80).optional(),
};

export const billCreateSchema = z.object(billFields)
  .strict()
  .refine(
    (data) => Boolean(data.companyId || data.companyDocId || data.companyName || data.toCompany),
    { message: "A company must be specified.", path: ["companyName"] }
  )
  .refine((data) => data.items?.length > 0, {
    message: "At least one bill item is required.",
    path: ["items"],
  });

export const billUpdateSchema = z.object(billFields)
  .partial()
  .strict()
  .refine((data) => Object.keys(data).length > 0, "Provide at least one field to update.");

export const billIdParamsSchema = z.object({
  billId: z.string().min(1).max(150),
}).strict();

export const billListQuerySchema = z.object({
  companyId: z.string().min(1).max(150).optional(),
  status: z.enum(["DRAFT", "ISSUED", "PARTIALLY_PAID", "PAID", "VOID"]).optional(),
  paymentStatus: z.enum(["PENDING", "PARTIALLY_PAID", "PAID", "FAILED", "REFUNDED"]).optional(),
  search: z.string().trim().max(120).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
}).strict();

export const paymentCreateSchema = z.object({
  amount: moneyInput,
  paymentMethod: z.string().trim().min(1).max(80).optional(),
  reference: z.string().trim().max(160).optional(),
  paidAt: z.string().datetime({ offset: true }).optional(),
}).strict();
