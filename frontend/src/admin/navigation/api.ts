import {
  navigationAdminDtoSchema,
  type NavigationAdminDto,
  type UpdateNavigationRequest,
} from "@maglive/contracts";
import { requestAdminData, requestAdminMutation } from "../auth/api";

export function getNavigation(): Promise<NavigationAdminDto> {
  return requestAdminData("/admin/navigation", navigationAdminDtoSchema);
}

export function updateNavigation(input: UpdateNavigationRequest): Promise<NavigationAdminDto> {
  return requestAdminMutation("/admin/navigation", navigationAdminDtoSchema, "PUT", input);
}
