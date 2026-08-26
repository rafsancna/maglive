import {
  adminProductListDtoSchema,
  productAdminDtoSchema,
  productDeletedDtoSchema,
  productPublicationResultSchema,
  type AdminProductListDto,
  type AdminProductListQuery,
  type ProductAdminDto,
  type ProductPublicationValidationResult,
  type PublishProductRequest,
  type UnpublishProductRequest,
} from "@maglive/contracts";
import { requestAdminData, requestAdminMutation } from "../auth/api";

export function productListPath(query: AdminProductListQuery): string {
  const parameters = new URLSearchParams({
    page: String(query.page),
    limit: String(query.limit),
    locale: query.locale,
    sort: query.sort,
  });
  if (query.search !== undefined) parameters.set("search", query.search);
  if (query.categoryId !== undefined) {
    parameters.set("categoryId", query.categoryId);
  }
  if (query.status !== undefined) parameters.set("status", query.status);
  if (query.localeState !== undefined) {
    parameters.set("localeState", query.localeState);
  }
  if (query.featured !== undefined) {
    parameters.set("featured", String(query.featured));
  }
  return `/admin/products?${parameters.toString()}`;
}

export function listProducts(
  query: AdminProductListQuery,
): Promise<AdminProductListDto> {
  return requestAdminData(productListPath(query), adminProductListDtoSchema);
}

export function duplicateProduct(
  id: string,
  version: number,
): Promise<ProductAdminDto> {
  return requestAdminMutation(
    `/admin/products/${id}/duplicate`,
    productAdminDtoSchema,
    "POST",
    { version },
  );
}

export async function publishProduct(
  id: string,
  input: PublishProductRequest,
): Promise<{
  product: ProductAdminDto;
  validation: ProductPublicationValidationResult;
}> {
  return requestAdminMutation(
    `/admin/products/${id}/publish`,
    productPublicationResultSchema,
    "POST",
    input,
  );
}

export function unpublishProduct(
  id: string,
  input: UnpublishProductRequest,
): Promise<ProductAdminDto> {
  return requestAdminMutation(
    `/admin/products/${id}/unpublish`,
    productAdminDtoSchema,
    "POST",
    input,
  );
}

export function archiveProduct(
  id: string,
  version: number,
): Promise<ProductAdminDto> {
  return requestAdminMutation(
    `/admin/products/${id}/archive`,
    productAdminDtoSchema,
    "POST",
    { version },
  );
}

export function deleteProduct(id: string, version: number): Promise<void> {
  return requestAdminMutation(
    `/admin/products/${id}`,
    productDeletedDtoSchema,
    "DELETE",
    { version },
  ).then(() => undefined);
}
