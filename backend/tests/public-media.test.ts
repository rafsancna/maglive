import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import {
  createPublicOriginsMiddleware,
  resolveMediaBaseUrl,
  runWithRequestOrigin,
} from "../src/storage/publicMedia.js";

describe("public media URLs", () => {
  it("keeps an absolute media base URL untouched", () => {
    expect(resolveMediaBaseUrl("https://cdn.example.com/uploads")).toBe(
      "https://cdn.example.com/uploads",
    );
    expect(
      runWithRequestOrigin("https://shop.example.com", () =>
        resolveMediaBaseUrl("https://cdn.example.com/uploads/"),
      ),
    ).toBe("https://cdn.example.com/uploads");
  });

  it("follows the request origin for relative and empty configurations", () => {
    expect(
      runWithRequestOrigin("http://192.168.1.40:5000", () => resolveMediaBaseUrl("")),
    ).toBe("http://192.168.1.40:5000/uploads");
    expect(
      runWithRequestOrigin("http://192.168.1.40:5000", () =>
        resolveMediaBaseUrl("/library"),
      ),
    ).toBe("http://192.168.1.40:5000/library");
  });

  it("stays relative when no origin is known", () => {
    expect(resolveMediaBaseUrl("")).toBe("/uploads");
  });

  it("uses the advertised origin before the request host", async () => {
    const app = express();
    app.use(createPublicOriginsMiddleware());
    app.get("/media-base", (_request, response) => {
      response.json({ base: resolveMediaBaseUrl("") });
    });

    const advertised = await request(app)
      .get("/media-base")
      .set("Host", "internal-api:5000")
      .set("X-Public-Origin", "https://shop.example.com")
      .expect(200);
    expect(advertised.body).toEqual({ base: "https://shop.example.com/uploads" });

    const ignored = await request(app)
      .get("/media-base")
      .set("Host", "internal-api:5000")
      .set("X-Public-Origin", "not-a-url")
      .expect(200);
    expect(ignored.body).toEqual({ base: "http://internal-api:5000/uploads" });
  });
});
