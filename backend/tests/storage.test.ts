import { readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import type {
  SaveObjectInput,
  StorageProvider,
  StoredObject,
} from "../src/storage/StorageProvider.js";
import request from "supertest";
import { afterEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { AppError } from "../src/errors/AppError.js";
import { LocalStorageProvider } from "../src/storage/LocalStorageProvider.js";
import { createTestConfig } from "./helpers/config.js";
import {
  createTemporaryUploadRoot,
  removeTemporaryUploadRoot,
} from "./helpers/temporaryUploadRoot.js";

class FakeStorageProvider implements StorageProvider {
  readonly id = "local" as const;
  readonly values = new Map<string, Uint8Array>();
  private sequence = 0;

  async save(input: SaveObjectInput): Promise<StoredObject> {
    const value = await readFile(input.temporaryPath);
    const key = `fake/${this.sequence += 1}.${input.extension}`;
    this.values.set(key, value);
    return { provider: this.id, key, sizeBytes: value.byteLength };
  }

  async delete(key: string): Promise<void> {
    this.values.delete(key);
  }

  async exists(key: string): Promise<boolean> {
    return this.values.has(key);
  }

  getPublicUrl(key: string): string {
    return `https://media.example/${key}`;
  }
}

const roots: string[] = [];

async function temporaryRoot(): Promise<string> {
  const root = await createTemporaryUploadRoot();
  roots.push(root);
  return root;
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map(removeTemporaryUploadRoot));
});

async function verifyProviderContract(
  provider: StorageProvider,
  temporaryPath: string,
): Promise<void> {
  const saved = await provider.save({
    temporaryPath,
    kind: "document",
    extension: "pdf",
    now: new Date("2026-08-26T00:00:00.000Z"),
  });
  expect(saved.provider).toBe("local");
  expect(saved.sizeBytes).toBe(13);
  expect(await provider.exists(saved.key)).toBe(true);
  expect(provider.getPublicUrl(saved.key)).toContain(saved.key);
  await provider.delete(saved.key);
  expect(await provider.exists(saved.key)).toBe(false);
  await provider.delete(saved.key);
}

describe("storage provider contract", () => {
  it("keeps fake and local providers behaviorally compatible", async () => {
    const root = await temporaryRoot();
    const source = path.join(root, "candidate.tmp");
    await writeFile(source, "%PDF-1.7\ntest");
    await verifyProviderContract(new FakeStorageProvider(), source);
    await verifyProviderContract(
      new LocalStorageProvider(
        path.join(root, "local"),
        "http://localhost:5000/uploads",
      ),
      source,
    );
  });

  it("uses immutable UUID keys and persists across provider restarts", async () => {
    const root = await temporaryRoot();
    const source = path.join(root, "same-name.tmp");
    await writeFile(source, "%PDF-1.7\ntest");
    const provider = new LocalStorageProvider(
      root,
      "http://localhost:5000/uploads",
    );
    const first = await provider.save({
      temporaryPath: source,
      kind: "document",
      extension: "pdf",
      now: new Date("2026-08-26T00:00:00.000Z"),
    });
    const second = await provider.save({
      temporaryPath: source,
      kind: "document",
      extension: "pdf",
      now: new Date("2026-08-26T00:00:00.000Z"),
    });
    expect(first.key).not.toBe(second.key);
    expect(first.key).toMatch(
      /^documents\/2026\/08\/26\/[0-9a-f-]{36}\.pdf$/,
    );
    expect(await stat(provider.resolveKey(first.key))).toMatchObject({
      size: 13,
    });
    const restarted = new LocalStorageProvider(
      root,
      "http://localhost:5000/uploads",
    );
    expect(await restarted.exists(first.key)).toBe(true);
    expect(restarted.getPublicUrl(first.key)).toBe(
      `http://localhost:5000/uploads/${first.key}`,
    );
  });

  it("rejects absolute, traversal, backslash, and source-tree escape keys", async () => {
    const root = await temporaryRoot();
    const provider = new LocalStorageProvider(
      root,
      "http://localhost:5000/uploads",
    );
    for (const key of [
      "../package.json",
      "images/../../source.ts",
      "images\\escape.jpg",
      path.resolve("outside.jpg"),
      ".",
    ]) {
      expect(() => provider.resolveKey(key)).toThrow(AppError);
    }
  });

  it("serves immutable typed files with nosniff and byte ranges", async () => {
    const root = await temporaryRoot();
    const source = path.join(root, "source.tmp");
    await writeFile(source, "%PDF-1.7\ntest");
    const provider = new LocalStorageProvider(
      root,
      "http://localhost:5000/uploads",
    );
    const saved = await provider.save({
      temporaryPath: source,
      kind: "document",
      extension: "pdf",
    });
    const app = createApp({
      config: createTestConfig({ uploadRoot: root }),
      databaseHealth: () => ({ status: "ready" }),
      storageProvider: provider,
    });

    const response = await request(app)
      .get(`/uploads/${saved.key}`)
      .expect(200);
    expect(response.headers["content-type"]).toMatch(/^application\/pdf/);
    expect(response.headers["x-content-type-options"]).toBe("nosniff");
    expect(response.headers["cross-origin-resource-policy"]).toBe("same-site");
    expect(response.headers["cache-control"]).toBe(
      "public, max-age=31536000, immutable",
    );
    expect(response.headers["accept-ranges"]).toBe("bytes");

    const range = await request(app)
      .get(`/uploads/${saved.key}`)
      .set("Range", "bytes=0-3")
      .expect(206);
    expect(range.headers["content-range"]).toMatch(/^bytes 0-3\/13$/);
  });
});
