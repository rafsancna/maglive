import { z } from "zod";

export const objectIdStringSchema = z
  .string()
  .regex(/^[a-f\d]{24}$/i, "Expected a 24-character hexadecimal ObjectId");

export const requestIdSchema = z.uuid();

export const fieldErrorSchema = z.object({
  path: z.string().min(1).max(240),
  code: z.string().min(1).max(80),
  message: z.string().min(1).max(500)
});
export type FieldError = z.infer<typeof fieldErrorSchema>;

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20)
});

export const paginationMetaSchema = z.object({
  page: z.number().int().min(1),
  limit: z.number().int().min(1).max(100),
  total: z.number().int().min(0),
  totalPages: z.number().int().min(0)
});
export type PaginationMeta = z.infer<typeof paginationMetaSchema>;

export function apiSuccessSchema<TSchema extends z.ZodType>(dataSchema: TSchema) {
  return z.object({
    data: dataSchema,
    meta: paginationMetaSchema.optional()
  });
}

export type ApiSuccess<TData> = {
  data: TData;
  meta?: PaginationMeta;
};

export const apiErrorSchema = z.object({
  error: z.object({
    code: z.string().min(1).max(80),
    message: z.string().min(1).max(500),
    details: z.array(fieldErrorSchema).optional(),
    requestId: requestIdSchema
  })
});
export type ApiError = z.infer<typeof apiErrorSchema>;

export const databaseHealthSchema = z.object({
  status: z.enum(["ready", "not-ready"])
});

export const healthDtoSchema = z.object({
  status: z.enum(["ok", "degraded"]),
  api: z.literal("ready"),
  database: databaseHealthSchema
});
export type HealthDto = z.infer<typeof healthDtoSchema>;
