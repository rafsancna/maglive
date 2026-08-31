import type { AdminMediaDto } from "@maglive/contracts";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  ADMIN_SESSION_EXPIRED_EVENT,
  clearCurrentCsrfToken,
  getAdminApiBaseUrl,
  getCurrentCsrfToken,
  setCurrentCsrfToken,
} from "@/admin/auth/api";
import { uploadMedia, watchMediaProcessing } from "@/admin/media/api";

class FakeXmlHttpRequest extends EventTarget {
  static instances: FakeXmlHttpRequest[] = [];

  readonly upload = new EventTarget();
  readonly headers = new Map<string, string>();
  readonly open = vi.fn();
  readonly send = vi.fn((body: Document | XMLHttpRequestBodyInit | null) => {
    this.sentBody = body;
  });
  readonly abort = vi.fn(() => {
    this.dispatchEvent(new Event("abort"));
  });
  sentBody: Document | XMLHttpRequestBodyInit | null = null;
  responseText = "";
  status = 0;
  withCredentials = false;

  constructor() {
    super();
    FakeXmlHttpRequest.instances.push(this);
  }

  setRequestHeader(name: string, value: string): void {
    this.headers.set(name, value);
  }
}

class FakeEventSource extends EventTarget {
  static readonly CLOSED = 2;
  static instances: FakeEventSource[] = [];
  readonly close = vi.fn(() => {
    this.readyState = FakeEventSource.CLOSED;
  });
  readyState = 0;

  constructor(
    public readonly url: string,
    public readonly options?: EventSourceInit,
  ) {
    super();
    FakeEventSource.instances.push(this);
  }
}

const uploadedMedia: AdminMediaDto = {
  id: "507f1f77bcf86cd799439011",
  kind: "image",
  url: "http://localhost:5000/uploads/images/2026/08/26/media.png",
  mimeType: "image/png",
  width: 1200,
  height: 800,
  originalName: "module.png",
  sizeBytes: 2048,
  checksum: "a".repeat(64),
  defaultTranslations: {},
  status: "ready",
  uploadedBy: "507f1f77bcf86cd799439012",
  createdAt: "2026-08-26T06:00:00.000Z",
  updatedAt: "2026-08-26T06:00:00.000Z",
  version: 0,
};

async function currentRequest(): Promise<FakeXmlHttpRequest> {
  await vi.waitFor(() => {
    expect(FakeXmlHttpRequest.instances).toHaveLength(1);
  });
  return FakeXmlHttpRequest.instances[0] as FakeXmlHttpRequest;
}

beforeEach(() => {
  FakeXmlHttpRequest.instances = [];
  FakeEventSource.instances = [];
  clearCurrentCsrfToken();
  setCurrentCsrfToken("authenticated-csrf-token-value-000001");
  vi.stubGlobal("XMLHttpRequest", FakeXmlHttpRequest);
  vi.stubGlobal("EventSource", FakeEventSource);
});

describe("media upload API client", () => {
  it("sends a credentialed multipart request and reports computable progress", async () => {
    const progress = vi.fn();
    const pending = uploadMedia(
      new File(["image"], "module.png", { type: "image/png" }),
      progress,
    );
    const xhr = await currentRequest();

    xhr.upload.dispatchEvent(
      new ProgressEvent("progress", {
        lengthComputable: true,
        loaded: 3,
        total: 4,
      }),
    );
    xhr.status = 201;
    xhr.responseText = JSON.stringify({ data: uploadedMedia });
    xhr.dispatchEvent(new Event("load"));

    await expect(pending).resolves.toEqual(uploadedMedia);
    expect(progress).toHaveBeenCalledWith(75);
    expect(xhr.open).toHaveBeenCalledWith(
      "POST",
      `${getAdminApiBaseUrl()}/admin/media`,
    );
    expect(xhr.withCredentials).toBe(true);
    expect(xhr.headers.get("Accept")).toBe("application/json");
    expect(xhr.headers.get("X-CSRF-Token")).toBe(
      "authenticated-csrf-token-value-000001",
    );
    expect(xhr.sentBody).toBeInstanceOf(FormData);
  });

  it("aborts the network request when the caller cancels", async () => {
    const controller = new AbortController();
    const pending = uploadMedia(
      new File(["image"], "module.png", { type: "image/png" }),
      vi.fn(),
      controller.signal,
    );
    const rejection = expect(pending).rejects.toMatchObject({
      code: "UPLOAD_ABORTED",
    });
    const xhr = await currentRequest();

    controller.abort();

    await rejection;
    expect(xhr.abort).toHaveBeenCalledOnce();
  });

  it("does not start a request for an already-cancelled upload", async () => {
    const controller = new AbortController();
    controller.abort();

    await expect(
      uploadMedia(
        new File(["image"], "module.png", { type: "image/png" }),
        vi.fn(),
        controller.signal,
      ),
    ).rejects.toMatchObject({ code: "UPLOAD_ABORTED" });
    expect(FakeXmlHttpRequest.instances).toHaveLength(0);
  });

  it("clears authentication state and emits the shared expiry event", async () => {
    let expiryEvents = 0;
    const countExpiry = () => {
      expiryEvents += 1;
    };
    window.addEventListener(ADMIN_SESSION_EXPIRED_EVENT, countExpiry);
    const pending = uploadMedia(
      new File(["image"], "module.png", { type: "image/png" }),
      vi.fn(),
    );
    const rejection = expect(pending).rejects.toMatchObject({
      code: "SESSION_EXPIRED",
    });
    const xhr = await currentRequest();

    xhr.status = 401;
    xhr.responseText = JSON.stringify({
      error: {
        code: "SESSION_EXPIRED",
        message: "Session expired.",
        requestId: "8a595af7-52c0-4fd0-8028-5f5a4a309509",
      },
    });
    xhr.dispatchEvent(new Event("load"));

    await rejection;
    window.removeEventListener(ADMIN_SESSION_EXPIRED_EVENT, countExpiry);
    expect(getCurrentCsrfToken()).toBeNull();
    expect(expiryEvents).toBe(1);
  });

  it("subscribes with credentials and resolves persistent processing updates", async () => {
    const onUpdate = vi.fn();
    const pending = watchMediaProcessing(uploadedMedia.id, onUpdate);
    const source = FakeEventSource.instances[0];
    expect(source).toBeDefined();
    expect(source?.url).toBe(`${getAdminApiBaseUrl()}/admin/media/${uploadedMedia.id}/events`);
    expect(source?.options).toEqual({ withCredentials: true });
    source?.dispatchEvent(
      new MessageEvent("media", {
        data: JSON.stringify({ ...uploadedMedia, status: "ready", progress: 100 }),
      }),
    );
    await expect(pending).resolves.toMatchObject({ status: "ready", progress: 100 });
    expect(onUpdate).toHaveBeenCalledOnce();
    expect(source?.close).toHaveBeenCalledOnce();
  });

  it("falls back to authenticated polling when the progress stream closes", async () => {
    const onUpdate = vi.fn();
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: { ...uploadedMedia, status: "ready", progress: 100 },
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const pending = watchMediaProcessing(uploadedMedia.id, onUpdate);
    const source = FakeEventSource.instances[0];
    expect(source).toBeDefined();
    if (source !== undefined) source.readyState = FakeEventSource.CLOSED;
    source?.dispatchEvent(new Event("error"));

    await expect(pending).resolves.toMatchObject({ status: "ready", progress: 100 });
    expect(fetchMock).toHaveBeenCalledWith(
      `${getAdminApiBaseUrl()}/admin/media/${uploadedMedia.id}`,
      expect.objectContaining({ cache: "no-store", credentials: "include" }),
    );
    expect(onUpdate).toHaveBeenCalledOnce();
  });
});
