import type { AdminMediaDto, MediaListDto } from "@maglive/contracts";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MediaPicker } from "@/admin/media/MediaPicker";
import * as mediaApi from "@/admin/media/api";

vi.mock("@/admin/media/api", () => ({
  listMedia: vi.fn(),
  uploadMedia: vi.fn(),
  watchMediaProcessing: vi.fn(),
}));

const uploaded: AdminMediaDto = {
  id: "507f191e810c19729de860ea",
  kind: "image",
  url: "http://localhost:5000/uploads/images/product.png",
  mimeType: "image/png",
  width: 1600,
  height: 1200,
  originalName: "product.png",
  sizeBytes: 128000,
  checksum: "a".repeat(64),
  defaultTranslations: { en: { title: "Product front view" } },
  status: "ready",
  uploadedBy: "507f1f77bcf86cd799439011",
  createdAt: "2026-08-26T00:00:00.000Z",
  updatedAt: "2026-08-26T00:00:00.000Z",
  version: 0,
};

function list(items: AdminMediaDto[]): MediaListDto {
  return {
    items,
    pagination: {
      page: 1,
      limit: 100,
      total: items.length,
      totalPages: items.length === 0 ? 0 : 1,
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(mediaApi.listMedia).mockResolvedValue(list([]));
});

describe("media picker", () => {
  it("loads only ready assets and selects an existing asset", async () => {
    vi.mocked(mediaApi.listMedia).mockResolvedValue(list([uploaded]));
    const onSelect = vi.fn();
    const user = userEvent.setup();

    render(
      <MediaPicker
        kind="image"
        onClose={vi.fn()}
        onSelect={onSelect}
        title="Choose hero photo"
      />,
    );

    await user.click(
      await screen.findByRole("button", { name: /Product front view/ }),
    );

    expect(mediaApi.listMedia).toHaveBeenCalledWith({
      kind: "image",
      search: "",
      status: "ready",
      limit: 100,
    });
    expect(onSelect).toHaveBeenCalledWith(uploaded);
  });

  it("uploads and immediately uses a new asset inside the picker", async () => {
    vi.mocked(mediaApi.uploadMedia).mockImplementation(
      async (_file, onProgress) => {
        onProgress(72);
        return uploaded;
      },
    );
    const onSelect = vi.fn();
    const user = userEvent.setup();

    render(
      <MediaPicker
        kind="image"
        onClose={vi.fn()}
        onSelect={onSelect}
        title="Choose hero photo"
      />,
    );

    await user.upload(
      screen.getByLabelText("Upload new photo"),
      new File(["image"], "product.png", { type: "image/png" }),
    );

    await waitFor(() => expect(onSelect).toHaveBeenCalledWith(uploaded));
    expect(mediaApi.uploadMedia).toHaveBeenCalledOnce();
  });

  it("waits for optimization before selecting a newly uploaded asset", async () => {
    const queued: AdminMediaDto = {
      ...uploaded,
      url: undefined,
      status: "queued",
      progress: 0,
      processingStage: "queued",
    };
    vi.mocked(mediaApi.uploadMedia).mockResolvedValue(queued);
    vi.mocked(mediaApi.watchMediaProcessing).mockImplementation(
      async (_id, onUpdate) => {
        onUpdate?.({ ...queued, status: "processing", progress: 64, processingStage: "creating-1280" });
        return { ...uploaded, progress: 100, processingStage: "ready" };
      },
    );
    const onSelect = vi.fn();
    const user = userEvent.setup();
    render(<MediaPicker kind="image" onClose={vi.fn()} onSelect={onSelect} />);

    await user.upload(
      screen.getByLabelText("Upload new photo"),
      new File(["image"], "product.png", { type: "image/png" }),
    );

    await waitFor(() => expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ status: "ready" })));
    expect(mediaApi.watchMediaProcessing).toHaveBeenCalledWith(
      queued.id,
      expect.any(Function),
      expect.any(AbortSignal),
    );
  });
});
