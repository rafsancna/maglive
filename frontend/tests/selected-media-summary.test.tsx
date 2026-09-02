import type { AdminMediaDto } from "@maglive/contracts";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SelectedMediaSummary } from "@/admin/media/SelectedMediaSummary";
import * as mediaApi from "@/admin/media/api";

vi.mock("@/admin/media/api", () => ({
  getMedia: vi.fn(),
}));

const selected: AdminMediaDto = {
  id: "507f191e810c19729de860ea",
  kind: "image",
  url: "http://localhost:5000/uploads/hero.jpg",
  mimeType: "image/jpeg",
  width: 1600,
  height: 900,
  originalName: "newsroom-hero.jpg",
  sizeBytes: 245_760,
  checksum: "a".repeat(64),
  defaultTranslations: { en: { title: "Newsroom hero", alt: "Solar site" } },
  status: "ready",
  uploadedBy: "507f191e810c19729de860eb",
  createdAt: "2026-09-02T00:00:00.000Z",
  updatedAt: "2026-09-02T00:00:00.000Z",
  version: 0,
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(mediaApi.getMedia).mockResolvedValue(selected);
});

describe("selected media summary", () => {
  it("loads and shows the preview, original filename, and asset details", async () => {
    render(<SelectedMediaSummary mediaId={selected.id} />);

    expect(await screen.findByText("newsroom-hero.jpg")).toBeInTheDocument();
    expect(screen.getByAltText("Solar site")).toBeInTheDocument();
    expect(screen.getByText("Newsroom hero")).toBeInTheDocument();
    expect(screen.getByText("Image · 1600 × 900 · 240.0 KB")).toBeInTheDocument();
  });
});
