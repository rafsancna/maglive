import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  apiOrigin,
  mediaOrigin,
  normalizeMediaUrlFields,
  resolveMediaUrl,
} from "@/lib/media-origin";

const originalEnvironment = { ...process.env };

function setEnvironment(values: Record<string, string | undefined>): void {
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

beforeEach(() => {
  setEnvironment({
    API_INTERNAL_URL: undefined,
    NEXT_PUBLIC_API_BASE_URL: undefined,
    MEDIA_PUBLIC_ORIGIN: undefined,
  });
});

afterEach(() => {
  process.env = { ...originalEnvironment };
  vi.unstubAllEnvs();
});

describe("media origin", () => {
  it("falls back to the browser-facing API origin before the internal one", () => {
    setEnvironment({ NEXT_PUBLIC_API_BASE_URL: "https://api.example.com/api/v1" });
    expect(apiOrigin()).toBe("https://api.example.com");

    setEnvironment({ API_INTERNAL_URL: "http://backend:5000/api/v1" });
    expect(apiOrigin()).toBe("https://api.example.com");
  });

  it("uses the local API during development", () => {
    expect(apiOrigin()).toBe("http://localhost:5000");
    expect(mediaOrigin()).toBe("http://localhost:5000");
  });

  it("prefers an explicit media origin", () => {
    setEnvironment({
      NEXT_PUBLIC_API_BASE_URL: "https://api.example.com/api/v1",
      MEDIA_PUBLIC_ORIGIN: "https://cdn.example.com",
    });
    expect(mediaOrigin()).toBe("https://cdn.example.com");
  });

  it("re-points media links at the deployment origin", () => {
    setEnvironment({
      NEXT_PUBLIC_API_BASE_URL: "http://192.168.1.40:5000/api/v1",
      MEDIA_PUBLIC_ORIGIN: "https://shop.example.com",
    });
    expect(resolveMediaUrl("http://192.168.1.40:5000/uploads/images/a.webp")).toBe(
      "https://shop.example.com/uploads/images/a.webp",
    );
    expect(resolveMediaUrl("http://localhost:5000/uploads/images/a.webp")).toBe(
      "https://shop.example.com/uploads/images/a.webp",
    );
    expect(resolveMediaUrl("/uploads/images/a.webp")).toBe(
      "https://shop.example.com/uploads/images/a.webp",
    );
  });

  it("rejects links that are not http(s) URLs", () => {
    expect(resolveMediaUrl("javascript:alert(1)")).toBeUndefined();
    expect(resolveMediaUrl("data:image/svg+xml;base64,PHN2Zz4=")).toBeUndefined();
  });

  it("follows a media link that still points at an older deployment origin", () => {
    setEnvironment({ MEDIA_PUBLIC_ORIGIN: "https://shop.example.com" });
    expect(resolveMediaUrl("https://staging.example.net/uploads/images/a.webp")).toBe(
      "https://shop.example.com/uploads/images/a.webp",
    );
  });

  it("rewrites stored media links and leaves content links alone", () => {
    setEnvironment({ NEXT_PUBLIC_API_BASE_URL: "http://192.168.1.40:5000/api/v1" });
    const payload = {
      cover: { url: "http://192.168.1.40:5000/uploads/images/a.webp" },
      items: [{ media: { url: "/uploads/images/b.webp" } }],
      image: { src: "http://192.168.1.40:5000/uploads/images/c.webp" },
      hero: { src: "/nav/hero.jpg" },
      blocks: [{ type: "link", url: "https://example.com/article" }],
    };

    expect(normalizeMediaUrlFields(payload)).toEqual([]);
    expect(payload.cover.url).toBe("http://192.168.1.40:5000/uploads/images/a.webp");
    expect(payload.items[0]?.media.url).toBe("http://192.168.1.40:5000/uploads/images/b.webp");
    expect(payload.image.src).toBe("http://192.168.1.40:5000/uploads/images/c.webp");
    // Local site assets keep their root-relative path.
    expect(payload.hero.src).toBe("/nav/hero.jpg");
    // External content links are not media and must stay untouched.
    expect(payload.blocks[0]?.url).toBe("https://example.com/article");

    expect(normalizeMediaUrlFields({ cover: { url: "javascript:alert(1)" } })).toEqual([
      "javascript:alert(1)",
    ]);
  });
});
