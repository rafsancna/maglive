import {
  seoAuditSchema,
  seoScoreResponseSchema,
  type SeoAudit,
  type SeoAuditRequest,
  type SeoDocumentInput,
  type SeoConnectionProvider,
  type SeoProviderCredentials,
  type SeoProviderSettings,
  type SeoProviderSettingsResponse,
  seoProviderSettingsResponseSchema,
  seoProviderSettingsSchema,
  type SeoScoreResponse,
  seoDashboardSummarySchema,
  type SeoDashboardSummary,
} from "@maglive/contracts";
import { requestAdminData, requestAdminMutation } from "../auth/api";

export function calculateSeoScore(
  input: SeoDocumentInput,
): Promise<SeoScoreResponse> {
  return requestAdminMutation(
    "/admin/seo/score",
    seoScoreResponseSchema,
    "POST",
    input,
  );
}

export function runSeoAudit(input: SeoAuditRequest): Promise<SeoAudit> {
  return requestAdminMutation("/admin/seo/audits", seoAuditSchema, "POST", input);
}

export function getLatestSeoAudit(input: SeoAuditRequest): Promise<SeoAudit | undefined> {
  const query = new URLSearchParams({ contentType: input.contentType, entityId: input.entityId, locale: input.locale });
  return requestAdminData(`/admin/seo/audits/latest?${query.toString()}`, seoAuditSchema.optional());
}

export function getSeoDashboardSummary(): Promise<SeoDashboardSummary> {
  return requestAdminData("/admin/seo/summary", seoDashboardSummarySchema);
}

export function getSeoProviderSettings(): Promise<SeoProviderSettingsResponse> {
  return requestAdminData("/admin/seo/providers", seoProviderSettingsResponseSchema);
}

export function saveSeoProviderSettings(
  provider: SeoConnectionProvider,
  credentials: SeoProviderCredentials,
  enabled: boolean,
): Promise<SeoProviderSettings> {
  return requestAdminMutation(`/admin/seo/providers/${provider}`, seoProviderSettingsSchema, "PUT", { provider, credentials, enabled });
}

export function testSeoProviderConnection(provider: SeoConnectionProvider): Promise<SeoProviderSettings> {
  return requestAdminMutation(`/admin/seo/providers/${provider}/test`, seoProviderSettingsSchema, "POST", { provider });
}
