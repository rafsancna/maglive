import {
  apiErrorSchema,
  adminMediaDtoSchema,
  mediaDeletedDtoSchema,
  mediaListDtoSchema,
  mediaUsagesDtoSchema,
  type AdminMediaDto,
  type MediaKind,
  type MediaListDto,
  type MediaUsagesDto,
  type UpdateMediaRequest,
} from "@maglive/contracts";
import {
  AdminApiError,
  clearCurrentCsrfToken,
  getAdminApiBaseUrl,
  getMutationCsrfToken,
  notifySessionExpired,
  requestAdminData,
  requestAdminMutation,
} from "../auth/api";

export type MediaListOptions = Readonly<{
  page?: number;
  limit?: number;
  search?: string;
  kind?: MediaKind;
}>;

export function listMedia(
  options: MediaListOptions = {},
): Promise<MediaListDto> {
  const query = new URLSearchParams({
    page: String(options.page ?? 1),
    limit: String(options.limit ?? 12),
  });
  if (options.search !== undefined && options.search !== "") {
    query.set("search", options.search);
  }
  if (options.kind !== undefined) query.set("kind", options.kind);
  return requestAdminData(
    `/admin/media?${query.toString()}`,
    mediaListDtoSchema,
  );
}

export function getMedia(id: string): Promise<AdminMediaDto> {
  return requestAdminData(`/admin/media/${id}`, adminMediaDtoSchema);
}

export function updateMedia(
  id: string,
  input: UpdateMediaRequest,
): Promise<AdminMediaDto> {
  return requestAdminMutation(
    `/admin/media/${id}`,
    adminMediaDtoSchema,
    "PATCH",
    input,
  );
}

export function getMediaUsages(id: string): Promise<MediaUsagesDto> {
  return requestAdminData(
    `/admin/media/${id}/usages`,
    mediaUsagesDtoSchema,
  );
}

export function deleteMedia(id: string, version: number): Promise<void> {
  return requestAdminMutation(
    `/admin/media/${id}`,
    mediaDeletedDtoSchema,
    "DELETE",
    { version },
  ).then(() => undefined);
}

function parseUploadResponse(xhr: XMLHttpRequest): AdminMediaDto {
  let payload: unknown;
  try {
    payload = JSON.parse(xhr.responseText) as unknown;
  } catch {
    throw new AdminApiError(
      502,
      "INVALID_API_RESPONSE",
      "The upload response is invalid.",
    );
  }
  if (xhr.status < 200 || xhr.status >= 300) {
    const parsed = apiErrorSchema.safeParse(payload);
    const code = parsed.success ? parsed.data.error.code : "UPLOAD_FAILED";
    const message = parsed.success
      ? parsed.data.error.message
      : "The media upload failed.";
    if (code === "AUTH_REQUIRED" || code === "SESSION_EXPIRED") {
      clearCurrentCsrfToken();
      notifySessionExpired();
    }
    throw new AdminApiError(xhr.status, code, message);
  }
  const data =
    typeof payload === "object" && payload !== null && "data" in payload
      ? payload.data
      : undefined;
  const parsed = adminMediaDtoSchema.safeParse(data);
  if (!parsed.success) {
    throw new AdminApiError(
      502,
      "INVALID_API_RESPONSE",
      "The upload response is invalid.",
    );
  }
  return parsed.data;
}

export async function uploadMedia(
  file: File,
  onProgress: (percentage: number) => void,
  signal?: AbortSignal,
): Promise<AdminMediaDto> {
  if (signal?.aborted === true) {
    throw new AdminApiError(
      0,
      "UPLOAD_ABORTED",
      "The media upload was cancelled.",
    );
  }
  const csrfToken = await getMutationCsrfToken();
  return new Promise<AdminMediaDto>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const abort = () => xhr.abort();
    signal?.addEventListener("abort", abort, { once: true });
    xhr.open("POST", `${getAdminApiBaseUrl()}/admin/media`);
    xhr.withCredentials = true;
    xhr.setRequestHeader("Accept", "application/json");
    xhr.setRequestHeader("X-CSRF-Token", csrfToken);
    xhr.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    });
    xhr.addEventListener("load", () => {
      signal?.removeEventListener("abort", abort);
      try {
        resolve(parseUploadResponse(xhr));
      } catch (error) {
        reject(error);
      }
    });
    xhr.addEventListener("error", () => {
      signal?.removeEventListener("abort", abort);
      reject(
        new AdminApiError(
          0,
          "API_UNAVAILABLE",
          "The CMS API is unavailable.",
        ),
      );
    });
    xhr.addEventListener("abort", () => {
      signal?.removeEventListener("abort", abort);
      reject(
        new AdminApiError(0, "UPLOAD_ABORTED", "The media upload was cancelled."),
      );
    });
    const form = new FormData();
    form.set("file", file);
    xhr.send(form);
  });
}
