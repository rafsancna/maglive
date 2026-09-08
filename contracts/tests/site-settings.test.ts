import { describe, expect, it } from "vitest";
import {
  publicSiteSettingsDtoSchema,
  siteSettingsAdminDtoSchema,
  updateSiteSettingsRequestSchema,
} from "../src/index.js";

const mediaId = "507f1f77bcf86cd799439011";

describe("site settings contracts", () => {
  it("supports an optional public browser icon", () => {
    expect(publicSiteSettingsDtoSchema.parse({ version: 0 })).toEqual({
      version: 0,
    });
    expect(
      publicSiteSettingsDtoSchema.parse({
        version: 2,
        icon: {
          id: mediaId,
          kind: "image",
          url: "http://localhost:5000/uploads/images/icon.webp",
          mimeType: "image/webp",
          width: 32,
          height: 32,
        },
      }).icon?.id,
    ).toBe(mediaId);
  });

  it("accepts selecting and removing the dashboard icon", () => {
    expect(
      updateSiteSettingsRequestSchema.parse({
        iconMediaId: mediaId,
        version: 1,
      }),
    ).toEqual({ iconMediaId: mediaId, version: 1 });
    expect(
      updateSiteSettingsRequestSchema.parse({ iconMediaId: null, version: 2 }),
    ).toEqual({ iconMediaId: null, version: 2 });
    expect(
      siteSettingsAdminDtoSchema.safeParse({
        iconMediaId: "invalid",
        version: 1,
      }).success,
    ).toBe(false);
  });
});
