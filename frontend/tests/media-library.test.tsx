import type {
  AdminMediaDto,
  MediaListDto,
  MediaUsagesDto,
} from "@maglive/contracts";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AdminApiError } from "@/admin/auth/api";
import { MediaLibrary } from "@/admin/media/MediaLibrary";
import * as mediaApi from "@/admin/media/api";

vi.mock("@/admin/media/api", () => ({
  deleteMedia: vi.fn(),
  getMediaUsages: vi.fn(),
  listMedia: vi.fn(),
  updateMedia: vi.fn(),
  uploadMedia: vi.fn(),
  retryMedia: vi.fn(),
  watchMediaProcessing: vi.fn(),
}));

const timestamp = "2026-08-26T00:00:00.000Z";
const adminId = "507f1f77bcf86cd799439011";

function media(
  overrides: Partial<AdminMediaDto> = {},
): AdminMediaDto {
  return {
    id: "507f191e810c19729de860ea",
    kind: "image",
    url: "http://localhost:5000/uploads/images/2026/08/26/media.png",
    mimeType: "image/png",
    width: 1200,
    height: 800,
    originalName: "poster.png",
    sizeBytes: 128000,
    checksum: "a".repeat(64),
    defaultTranslations: {
      en: { title: "Product poster", alt: "Solar array" },
    },
    status: "ready",
    uploadedBy: adminId,
    createdAt: timestamp,
    updatedAt: timestamp,
    version: 0,
    ...overrides,
  };
}

const image = media();
const video = media({
  id: "507f1f77bcf86cd799439012",
  kind: "video",
  url: "http://localhost:5000/uploads/videos/2026/08/26/launch.mp4",
  mimeType: "video/mp4",
  originalName: "launch.mp4",
  defaultTranslations: {},
});

function list(items: AdminMediaDto[]): MediaListDto {
  return {
    items,
    pagination: {
      page: 1,
      limit: 12,
      total: items.length,
      totalPages: items.length === 0 ? 0 : 1,
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(mediaApi.listMedia).mockResolvedValue(list([image, video]));
  vi.mocked(mediaApi.getMediaUsages).mockResolvedValue({ usages: [] });
});

describe("media library", () => {
  it("renders typed previews, filters, localized metadata, and pagination state", async () => {
    const user = userEvent.setup();
    render(<MediaLibrary />);

    expect(
      await screen.findByRole("heading", { name: "Media library" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /poster.png/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /launch.mp4/ })).toBeInTheDocument();
    expect(screen.getByText("Page 1 of 1")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Photos/ }));
    await waitFor(() => {
      expect(mediaApi.listMedia).toHaveBeenLastCalledWith(
        expect.objectContaining({ kind: "image", page: 1 }),
      );
    });
    await user.click(screen.getByRole("tab", { name: "Simplified Chinese" }));
    expect(screen.getByLabelText("Default title")).toHaveValue("");
  });

  it("reports progress, keeps a failed file for retry, and completes the retry", async () => {
    const uploaded = media({
      id: "507f1f77bcf86cd799439013",
      originalName: "new-image.png",
    });
    vi.mocked(mediaApi.uploadMedia)
      .mockImplementationOnce(async (_file, onProgress) => {
        onProgress(52);
        throw new AdminApiError(0, "API_UNAVAILABLE", "Unavailable");
      })
      .mockImplementationOnce(async (_file, onProgress) => {
        onProgress(100);
        return uploaded;
      });
    const user = userEvent.setup();
    render(<MediaLibrary />);
    await screen.findByRole("button", { name: /poster.png/ });

    const file = new File(["image"], "new-image.png", { type: "image/png" });
    await user.upload(screen.getByLabelText("Upload media"), file);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      /retry without selecting/i,
    );
    expect(screen.getByRole("progressbar", { name: "Upload and optimization progress" })).toHaveAttribute("value", "52");
    await user.click(screen.getByRole("button", { name: "Retry upload" }));

    expect(await screen.findByRole("status")).toHaveTextContent(
      "Media optimized and ready.",
    );
    expect(mediaApi.uploadMedia).toHaveBeenCalledTimes(2);
  });

  it("shows usage blockers and assigns a ready image as a video poster", async () => {
    const usages: MediaUsagesDto = {
      usages: [
        {
          kind: "category-working-image",
          ownerId: "507f1f77bcf86cd799439099",
          ownerLabel: "modules",
          path: "image.mediaId",
        },
      ],
    };
    vi.mocked(mediaApi.getMediaUsages).mockImplementation(async (id) =>
      id === image.id ? usages : { usages: [] },
    );
    vi.mocked(mediaApi.updateMedia).mockResolvedValue({
      ...video,
      posterMediaId: image.id,
      version: 1,
    });
    const user = userEvent.setup();
    render(<MediaLibrary />);
    await screen.findByRole("button", { name: /poster.png/ });

    expect(await screen.findByText("modules")).toBeInTheDocument();
    expect(screen.getByText("Category image")).toBeInTheDocument();
    expect(screen.getByText("Working draft")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete asset" })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: /launch.mp4/ }));
    await user.click(
      await screen.findByRole("button", { name: "Choose ready image" }),
    );
    const posterDialog = await screen.findByRole("dialog", {
      name: "Choose video poster",
    });
    await user.click(
      within(posterDialog).getByRole("button", { name: /poster.png/ }),
    );

    await waitFor(() => {
      expect(mediaApi.updateMedia).toHaveBeenCalledWith(video.id, {
        version: video.version,
        posterMediaId: image.id,
      });
    });
  });
});
