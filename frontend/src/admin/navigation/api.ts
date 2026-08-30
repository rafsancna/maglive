import {
  navigationAdminDtoSchema,
  type NavigationAdminDto,
  type UpdateNavigationRequest,
} from "@maglive/contracts";
import { requestAdminData, requestAdminMutation } from "../auth/api";

export function getNavigation(): Promise<NavigationAdminDto> {
  return requestAdminData("/admin/navigation", navigationAdminDtoSchema);
}

export function updateNavigation(input: NavigationAdminDto): Promise<NavigationAdminDto> {
  const request: UpdateNavigationRequest = {
    primaryItems: input.primaryItems,
    productCategories: input.productCategories,
    featuredProducts: input.featuredProducts,
    solutionCategories: input.solutionCategories,
    featuredSolution: input.featuredSolution,
    cases: input.cases,
    news: input.news,
    documents: input.documents,
    services: input.services,
    version: input.version,
  };
  return requestAdminMutation("/admin/navigation", navigationAdminDtoSchema, "PUT", request);
}
