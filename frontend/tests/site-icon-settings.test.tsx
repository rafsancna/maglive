import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SiteIconSettings } from "@/admin/site-settings/SiteIconSettings";
import { getSiteSettings, updateSiteSettings } from "@/admin/site-settings/api";

const { refresh } = vi.hoisted(() => ({ refresh: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
}));

vi.mock("@/admin/site-settings/api", () => ({
  getSiteSettings: vi.fn(),
  updateSiteSettings: vi.fn(),
}));

vi.mock("@/admin/media/SelectedMediaSummary", () => ({
  SelectedMediaSummary: ({ mediaId }: { mediaId: string }) => (
    <div>Selected media {mediaId}</div>
  ),
}));

const mediaId = "507f1f77bcf86cd799439011";

vi.mock("@/admin/media/MediaPicker", () => ({
  MediaPicker: ({ onSelect }: { onSelect: (media: unknown) => void }) => (
    <button
      onClick={() =>
        onSelect({
          id: mediaId,
          kind: "image",
          url: "http://localhost:5000/uploads/images/icon.webp",
          mimeType: "image/webp",
          originalName: "icon.webp",
          sizeBytes: 128,
          checksum: "a".repeat(64),
          defaultTranslations: {},
          status: "ready",
          uploadedBy: "507f191e810c19729de860ea",
          createdAt: "2026-09-08T10:00:00.000Z",
          updatedAt: "2026-09-08T10:00:00.000Z",
          version: 0,
        })
      }
      type="button"
    >
      Select square icon
    </button>
  ),
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getSiteSettings).mockResolvedValue({ version: 0 });
  vi.mocked(updateSiteSettings).mockResolvedValue({
    iconMediaId: mediaId,
    version: 1,
  });
});

describe("browser tab icon dashboard setting", () => {
  it("selects an image and saves its media id", async () => {
    const user = userEvent.setup();
    render(<SiteIconSettings />);

    expect(
      await screen.findByText("No custom icon selected"),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Choose icon" }));
    await user.click(
      screen.getByRole("button", { name: "Select square icon" }),
    );
    await user.click(screen.getByRole("button", { name: "Save icon" }));

    await waitFor(() => {
      expect(updateSiteSettings).toHaveBeenCalledWith(
        { version: 0 },
        mediaId,
      );
    });
    expect(await screen.findByText("Browser tab icon updated.")).toBeVisible();
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("removes a previously selected icon", async () => {
    vi.mocked(getSiteSettings).mockResolvedValue({
      iconMediaId: mediaId,
      version: 3,
    });
    vi.mocked(updateSiteSettings).mockResolvedValue({ version: 4 });
    const user = userEvent.setup();
    render(<SiteIconSettings />);

    await screen.findByText(`Selected media ${mediaId}`);
    await user.click(screen.getByRole("button", { name: "Remove" }));
    await user.click(screen.getByRole("button", { name: "Save icon" }));

    await waitFor(() => {
      expect(updateSiteSettings).toHaveBeenCalledWith(
        { iconMediaId: mediaId, version: 3 },
        null,
      );
    });
  });
});
