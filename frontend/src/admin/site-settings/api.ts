import {
  siteSettingsAdminDtoSchema,
  type SiteSettingsAdminDto,
} from "@maglive/contracts";
import { requestAdminData, requestAdminMutation } from "../auth/api";

export function getSiteSettings(): Promise<SiteSettingsAdminDto> {
  return requestAdminData(
    "/admin/site-settings",
    siteSettingsAdminDtoSchema,
  );
}

export function updateSiteSettings(
  settings: SiteSettingsAdminDto,
  iconMediaId: string | null,
): Promise<SiteSettingsAdminDto> {
  return requestAdminMutation(
    "/admin/site-settings",
    siteSettingsAdminDtoSchema,
    "PUT",
    { iconMediaId, version: settings.version },
  );
}
