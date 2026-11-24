import { z } from "zod";

const dateRange = {
  from: z.string().date().optional(),
  to: z.string().date().optional(),
};

const pagination = {
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
};

function isValidRange(data) {
  return !data.from || !data.to || data.from <= data.to;
}

export const reportDateQuerySchema = z.object(dateRange)
  .strict()
  .refine(isValidRange, { message: "The start date must not be after the end date." });

export const reportListQuerySchema = z.object({
  ...dateRange,
  ...pagination,
  type: z.string().trim().min(1).max(80).optional(),
}).strict().refine(isValidRange, {
  message: "The start date must not be after the end date.",
});
