import { z } from "zod";
import { objectIdStringSchema } from "./api.js";

export const adminRoleSchema = z.literal("admin");

export const safeAdminDtoSchema = z.object({
  id: objectIdStringSchema,
  email: z.email(),
  role: adminRoleSchema
});
export type SafeAdminDto = z.infer<typeof safeAdminDtoSchema>;

export const csrfDtoSchema = z.object({
  csrfToken: z.string().min(32).max(256)
});
export type CsrfDto = z.infer<typeof csrfDtoSchema>;

export const loginRequestSchema = z.object({
  email: z.email().max(254).transform((value) => value.trim().toLowerCase()),
  password: z.string().min(1).max(1024)
});
export type LoginRequest = z.infer<typeof loginRequestSchema>;
