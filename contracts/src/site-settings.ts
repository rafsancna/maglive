import { z } from "zod";
import { objectIdStringSchema } from "./api.js";
import { publicMediaDtoSchema } from "./media.js";

export const siteSettingsAdminDtoSchema = z
  .object({
    iconMediaId: objectIdStringSchema.optional(),
    version: z.number().int().min(0),
    updatedAt: z.iso.datetime().optional(),
  })
  .strict();

export const updateSiteSettingsRequestSchema = z
  .object({
    iconMediaId: objectIdStringSchema.nullable(),
    version: z.number().int().min(0),
  })
  .strict();

export const publicSiteSettingsDtoSchema = z
  .object({
    icon: publicMediaDtoSchema.optional(),
    version: z.number().int().min(0),
  })
  .strict();

export type SiteSettingsAdminDto = z.infer<typeof siteSettingsAdminDtoSchema>;
export type UpdateSiteSettingsRequest = z.infer<
  typeof updateSiteSettingsRequestSchema
>;
export type PublicSiteSettingsDto = z.infer<
  typeof publicSiteSettingsDtoSchema
>;
