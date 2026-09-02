import type {
  PublicNewsDetailDto,
  PublicNewsSummaryDto,
} from "@maglive/contracts";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { NewsDetail } from "@/components/news/NewsDetail";
import { NewsExplorer } from "@/components/news/NewsExplorer";
import {
  blocksToWriterDocument,
  writerDocumentToBlocks,
} from "@/admin/news/NewsWriter";

const base: PublicNewsSummaryDto = {
  id: "507f1f77bcf86cd799439011",
  slug: "solar-expansion",
  category: "company-news",
  authorName: "Maglive Newsroom",
  featured: true,
  tags: ["solar", "growth"],
  title: "Solar expansion",
  excerpt: "A major expansion of clean-energy operations.",
  publishedAt: "2026-09-01T00:00:00.000Z",
  updatedAt: "2026-09-01T00:00:00.000Z",
  availableLocales: ["en", "zh"],
};

describe("public news experience", () => {
  it("filters news instantly by search, category, and topic", async () => {
    const second: PublicNewsSummaryDto = {
      ...base,
      id: "507f1f77bcf86cd799439012",
      slug: "inverter-launch",
      title: "Inverter launch",
      excerpt: "A new commercial inverter.",
      category: "product-news",
      tags: ["inverter"],
      featured: false,
    };
    render(
      <NewsExplorer
        categories={["company-news", "product-news"]}
        items={[base, second]}
        locale="en"
      />,
    );
    expect(screen.getByText("Solar expansion")).toBeInTheDocument();
    expect(screen.getByText("Inverter launch")).toBeInTheDocument();
    await userEvent.type(
      screen.getByRole("searchbox", { name: "Search news" }),
      "inverter",
    );
    expect(screen.queryByText("Solar expansion")).not.toBeInTheDocument();
    expect(screen.getByText("Inverter launch")).toBeInTheDocument();
    expect(screen.getByText("1 news update")).toBeInTheDocument();
  });

  it("renders structured news blocks and viewable document links", () => {
    const news: PublicNewsDetailDto = {
      ...base,
      content: [
        {
          id: "e8514f94-3a59-4f31-8db3-39c4c509f1f5",
          type: "paragraph",
          text: "Complete newsroom details.",
        },
        {
          id: "84081265-6dd2-41f8-a5aa-d142560ce1cc",
          type: "document",
          label: "Project brief",
          description: "Read the technical PDF.",
          media: {
            id: "507f1f77bcf86cd799439099",
            kind: "document",
            url: "http://localhost:5000/uploads/documents/brief.pdf",
            mimeType: "application/pdf",
          },
        },
      ],
      seo: { keywords: ["solar"] },
      readingMinutes: 2,
    };
    render(<NewsDetail locale="en" news={news} />);
    expect(
      screen.getByRole("heading", { name: "Solar expansion" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Complete newsroom details.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Project brief/ })).toHaveAttribute(
      "href",
      "http://localhost:5000/uploads/documents/brief.pdf",
    );
    expect(screen.getByText("2 min read")).toBeInTheDocument();
  });

  it("uses the hero image as a full-width backdrop instead of inline content", () => {
    const news: PublicNewsDetailDto = {
      ...base,
      heroMedia: {
        id: "507f1f77bcf86cd799439098",
        kind: "image",
        url: "/uploads/images/solar-expansion.jpg",
        mimeType: "image/jpeg",
        width: 1600,
        height: 900,
      },
      content: [{
        id: "e8514f94-3a59-4f31-8db3-39c4c509f1f5",
        type: "paragraph",
        text: "Complete newsroom details.",
      }],
      seo: { keywords: ["solar"] },
      readingMinutes: 2,
    };

    const { container } = render(<NewsDetail locale="en" news={news} />);
    const hero = container.querySelector(".news-detail__hero");
    const backdrop = hero?.querySelector(".news-detail__backdrop");

    expect(hero).toHaveClass("news-detail__hero--with-media");
    expect(backdrop).toBeInTheDocument();
    expect(backdrop?.querySelector("img")).toHaveAttribute("alt", "");
    expect(container.querySelector(".news-detail__layout figure")).toBeNull();
  });

  it("round-trips rich newsroom formatting without storing arbitrary HTML", () => {
    const blocks = [
      {
        id: "e8514f94-3a59-4f31-8db3-39c4c509f1f5",
        type: "paragraph" as const,
        text: "Maglive opens a new facility.",
        richText: [
          {
            type: "text" as const,
            text: "Maglive",
            marks: [{ type: "bold" as const }],
          },
          { type: "text" as const, text: " opens a " },
          {
            type: "text" as const,
            text: "new facility",
            marks: [{ type: "link" as const, href: "/en/news/new-facility" }],
          },
          { type: "text" as const, text: "." },
        ],
        alignment: "center" as const,
      },
      { id: "84081265-6dd2-41f8-a5aa-d142560ce1cc", type: "divider" as const },
    ];

    expect(writerDocumentToBlocks(blocksToWriterDocument(blocks))).toEqual(
      blocks,
    );
  });

  it("renders rich formatting and editorial dividers on published news", () => {
    const news: PublicNewsDetailDto = {
      ...base,
      content: [
        {
          id: "e8514f94-3a59-4f31-8db3-39c4c509f1f5",
          type: "paragraph",
          text: "Important newsroom update",
          richText: [
            { type: "text", text: "Important", marks: [{ type: "bold" }] },
            { type: "text", text: " newsroom update" },
          ],
        },
        { id: "84081265-6dd2-41f8-a5aa-d142560ce1cc", type: "divider" },
      ],
      seo: { keywords: ["solar"] },
      readingMinutes: 1,
    };
    const { container } = render(<NewsDetail locale="en" news={news} />);
    expect(screen.getByText("Important").tagName).toBe("STRONG");
    expect(container.querySelector(".news-body__divider")).toBeInTheDocument();
  });
});
