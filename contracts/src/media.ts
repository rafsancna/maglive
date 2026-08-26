import { z } from "zod";
import { objectIdStringSchema } from "./api.js";

export const mediaKindSchema = z.enum(["image", "video", "document"]);
export type MediaKind = z.infer<typeof mediaKindSchema>;

export const publicMediaDtoSchema = z.object({
  id: objectIdStringSchema,
  kind: mediaKindSchema,
  url: z.url(),
  mimeType: z.string().min(1).max(160),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional()
});
export type PublicMediaDto = z.infer<typeof publicMediaDtoSchema>;
