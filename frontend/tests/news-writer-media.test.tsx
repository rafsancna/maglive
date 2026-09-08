import type { AdminMediaDto, NewsContentBlock } from "@maglive/contracts";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NewsWriter } from "@/admin/news/NewsWriter";
import * as mediaApi from "@/admin/media/api";

vi.mock("@/admin/media/api", () => ({
  getMedia: vi.fn(),
}));

const media: AdminMediaDto = {
  id: "6a94238ccbfff98e82530bf8",
  kind: "image",
  url: "http://localhost:5000/uploads/images/canvas-photo.jpg",
  mimeType: "image/jpeg",
  width: 1280,
  height: 960,
  originalName: "canvas-photo.jpg",
  sizeBytes: 320_000,
  checksum: "a".repeat(64),
  defaultTranslations: {
    en: { title: "News canvas photo", alt: "Solar technicians" },
  },
  status: "ready",
  uploadedBy: "507f191e810c19729de860eb",
  createdAt: "2026-09-02T00:00:00.000Z",
  updatedAt: "2026-09-02T00:00:00.000Z",
  version: 0,
};

const blocks: NewsContentBlock[] = [
  {
    id: "e8514f94-3a59-4f31-8db3-39c4c509f1f5",
    type: "image",
    mediaId: media.id,
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(mediaApi.getMedia).mockResolvedValue(media);
});

describe("news writer media canvas", () => {
  it("hydrates a saved image block with its real preview and filename", async () => {
    const { container } = render(
      <NewsWriter
        blocks={blocks}
        locale="en"
        onChange={vi.fn()}
        onChooseMedia={vi.fn()}
      />,
    );

    await screen.findAllByText("canvas-photo.jpg");
    const canvas = container.querySelector<HTMLElement>(".news-writer__canvas");
    expect(canvas).not.toBeNull();
    expect(within(canvas!).getByText("canvas-photo.jpg")).toBeInTheDocument();
    expect(within(canvas!).getByAltText("Solar technicians")).toHaveAttribute(
      "src",
      media.url,
    );
    expect(within(canvas!).queryByText(media.id)).not.toBeInTheDocument();
    expect(canvas!.querySelector(".news-writer-embed")).toHaveClass(
      "news-writer-embed--size-medium",
      "news-writer-embed--align-center",
      "news-writer-embed--ratio-original",
    );
    expect(mediaApi.getMedia).toHaveBeenCalledWith(media.id);
  });

  it("edits image size, alignment, crop, and metadata inside the image block", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { container } = render(
      <NewsWriter
        blocks={blocks}
        locale="en"
        onChange={onChange}
        onChooseMedia={vi.fn()}
      />,
    );
    const imageBlock = container.querySelector<HTMLElement>(
      ".news-writer-embed--image",
    );
    expect(imageBlock).not.toBeNull();
    Object.defineProperty(document, "elementFromPoint", {
      configurable: true,
      value: vi.fn(() => imageBlock),
    });

    await user.click(imageBlock!);

    const toolbar = await screen.findByRole("toolbar", {
      name: "Image layout controls",
    });
    expect(screen.queryByText("Selected embed")).not.toBeInTheDocument();
    await user.click(
      within(toolbar).getByRole("button", { name: "Large image width" }),
    );
    expect(imageBlock).toHaveClass("news-writer-embed--size-large");

    await user.click(
      within(toolbar).getByRole("button", { name: "Align image right" }),
    );
    expect(imageBlock).toHaveClass("news-writer-embed--align-right");

    await user.click(within(toolbar).getByRole("button", { name: /Crop:/ }));
    await user.click(screen.getByRole("button", { name: "16:9" }));
    expect(imageBlock).toHaveClass("news-writer-embed--ratio-landscape");

    const alt = screen.getByPlaceholderText(
      "Describe the image for screen readers",
    );
    await user.clear(alt);
    await user.type(alt, "Technicians inspecting solar equipment");
    expect(onChange).toHaveBeenCalled();
  });
});
