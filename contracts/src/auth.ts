import { z } from "zod";
import { objectIdStringSchema } from "./api.js";

export const adminRoleSchema = z.literal("admin");

export const normalizedEmailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email().max(254));

export const safeAdminDtoSchema = z.object({
  id: objectIdStringSchema,
  email: normalizedEmailSchema,
  role: adminRoleSchema
});
export type SafeAdminDto = z.infer<typeof safeAdminDtoSchema>;

export const csrfDtoSchema = z.object({
  csrfToken: z.string().min(32).max(256)
});
export type CsrfDto = z.infer<typeof csrfDtoSchema>;

export const loginRequestSchema = z.object({
  email: normalizedEmailSchema,
  password: z.string().min(1).max(1024)
});
export type LoginRequest = z.infer<typeof loginRequestSchema>;

export const administratorPasswordSchema = z.string().min(12).max(1024);

export const bootstrapAdminRequestSchema = z.object({
  email: normalizedEmailSchema,
  password: administratorPasswordSchema,
  updateExisting: z.boolean().default(false)
});
export type BootstrapAdminRequest = z.infer<typeof bootstrapAdminRequestSchema>;

export const authenticatedSessionDtoSchema = z.object({
  admin: safeAdminDtoSchema,
  csrfToken: csrfDtoSchema.shape.csrfToken
});
export type AuthenticatedSessionDto = z.infer<typeof authenticatedSessionDtoSchema>;

export const logoutDtoSchema = z.object({
  loggedOut: z.literal(true)
});
export type LogoutDto = z.infer<typeof logoutDtoSchema>;
