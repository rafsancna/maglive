import {
  categoryAdminDtoSchema,
  categoryDeletedDtoSchema,
  categoryListDtoSchema,
  type CategoryAdminDto,
  type CreateCategoryRequest,
  type PublishCategoryRequest,
  type ReorderCategoriesRequest,
  type UnpublishCategoryRequest,
  type UpdateCategoryRequest,
} from "@maglive/contracts";
import {
  requestAdminData,
  requestAdminMutation,
} from "../auth/api";

export async function listCategories(): Promise<CategoryAdminDto[]> {
  const result = await requestAdminData(
    "/admin/categories",
    categoryListDtoSchema,
  );
  return result.categories;
}

export function createCategory(
  input: CreateCategoryRequest,
): Promise<CategoryAdminDto> {
  return requestAdminMutation(
    "/admin/categories",
    categoryAdminDtoSchema,
    "POST",
    input,
  );
}

export function updateCategory(
  id: string,
  input: UpdateCategoryRequest,
): Promise<CategoryAdminDto> {
  return requestAdminMutation(
    `/admin/categories/${id}`,
    categoryAdminDtoSchema,
    "PATCH",
    input,
  );
}

export function reorderCategories(
  input: ReorderCategoriesRequest,
): Promise<CategoryAdminDto[]> {
  return requestAdminMutation(
    "/admin/categories/reorder",
    categoryListDtoSchema,
    "POST",
    input,
  ).then((result) => result.categories);
}

export function publishCategory(
  id: string,
  input: PublishCategoryRequest,
): Promise<CategoryAdminDto> {
  return requestAdminMutation(
    `/admin/categories/${id}/publish`,
    categoryAdminDtoSchema,
    "POST",
    input,
  );
}

export function unpublishCategory(
  id: string,
  input: UnpublishCategoryRequest,
): Promise<CategoryAdminDto> {
  return requestAdminMutation(
    `/admin/categories/${id}/unpublish`,
    categoryAdminDtoSchema,
    "POST",
    input,
  );
}

export function archiveCategory(
  id: string,
  version: number,
): Promise<CategoryAdminDto> {
  return requestAdminMutation(
    `/admin/categories/${id}/archive`,
    categoryAdminDtoSchema,
    "POST",
    { version },
  );
}

export function deleteCategory(id: string, version: number): Promise<void> {
  return requestAdminMutation(
    `/admin/categories/${id}`,
    categoryDeletedDtoSchema,
    "DELETE",
    { version },
  ).then(() => undefined);
}
