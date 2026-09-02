import {
  adminNewsListDtoSchema, newsAdminDtoSchema, newsDeletedDtoSchema,
  type AdminNewsListDto, type AdminNewsListQuery, type CreateNewsRequest,
  type NewsAdminDto, type PublishNewsRequest, type UnpublishNewsRequest, type UpdateNewsRequest,
} from "@maglive/contracts";
import { requestAdminData, requestAdminMutation } from "../auth/api";

export function listNews(query: Partial<AdminNewsListQuery> = {}): Promise<AdminNewsListDto> {
  const parameters = new URLSearchParams({ page: String(query.page ?? 1), limit: String(query.limit ?? 20) });
  if (query.search) parameters.set("search", query.search);
  if (query.locale) parameters.set("locale", query.locale);
  if (query.status) parameters.set("status", query.status);
  if (query.category) parameters.set("category", query.category);
  return requestAdminData(`/admin/news?${parameters}`, adminNewsListDtoSchema);
}
export function getNews(id: string): Promise<NewsAdminDto> { return requestAdminData(`/admin/news/${id}`, newsAdminDtoSchema); }
export function createNews(input: CreateNewsRequest): Promise<NewsAdminDto> { return requestAdminMutation("/admin/news", newsAdminDtoSchema, "POST", input); }
export function updateNews(id: string, input: UpdateNewsRequest): Promise<NewsAdminDto> { return requestAdminMutation(`/admin/news/${id}`, newsAdminDtoSchema, "PATCH", input); }
export function publishNews(id: string, input: PublishNewsRequest): Promise<NewsAdminDto> { return requestAdminMutation(`/admin/news/${id}/publish`, newsAdminDtoSchema, "POST", input); }
export function unpublishNews(id: string, input: UnpublishNewsRequest): Promise<NewsAdminDto> { return requestAdminMutation(`/admin/news/${id}/unpublish`, newsAdminDtoSchema, "POST", input); }
export function archiveNews(id: string, version: number): Promise<NewsAdminDto> { return requestAdminMutation(`/admin/news/${id}/archive`, newsAdminDtoSchema, "POST", { version }); }
export function deleteNews(id: string, version: number): Promise<void> { return requestAdminMutation(`/admin/news/${id}`, newsDeletedDtoSchema, "DELETE", { version }).then(() => undefined); }
