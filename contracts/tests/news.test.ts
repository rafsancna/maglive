import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { newsContentBlockSchema } from "../src/news.js";

describe("news rich text contracts", () => {
  it("accepts portable formatting and rejects unsafe inline links", () => {
    const valid = newsContentBlockSchema.safeParse({
      id: randomUUID(),
      type: "paragraph",
      text: "Read the project update.",
      richText: [
        { type: "text", text: "Read the ", marks: [{ type: "bold" }] },
        {
          type: "text",
          text: "project update",
          marks: [{ type: "link", href: "/en/news/project-update" }],
        },
        { type: "text", text: "." },
      ],
      alignment: "center",
    });
    expect(valid.success).toBe(true);

    const unsafe = newsContentBlockSchema.safeParse({
      id: randomUUID(),
      type: "paragraph",
      text: "Unsafe link",
      richText: [
        {
          type: "text",
          text: "Unsafe link",
          marks: [{ type: "link", href: "javascript:alert(1)" }],
        },
      ],
    });
    expect(unsafe.success).toBe(false);
  });

  it("supports editorial divider blocks", () => {
    expect(
      newsContentBlockSchema.parse({ id: randomUUID(), type: "divider" }).type,
    ).toBe("divider");
  });
});
