import { randomUUID } from "node:crypto";
import {
  constants,
  copyFile,
  mkdir,
  rename,
  rm,
  stat,
} from "node:fs/promises";
import path from "node:path";
import { AppError } from "../errors/AppError.js";
import type {
  SaveObjectInput,
  StorageProvider,
  StoredObject,
} from "./StorageProvider.js";

const kindDirectory = {
  image: "images",
  video: "videos",
  document: "documents",
} as const;

function isMissingFile(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "ENOENT"
  );
}

export class LocalStorageProvider implements StorageProvider {
  readonly id = "local" as const;
  readonly root: string;
  readonly publicBaseUrl: string;

  constructor(root: string, publicBaseUrl: string) {
    this.root = path.resolve(root);
    this.publicBaseUrl = publicBaseUrl.replace(/\/$/, "");
  }

  resolveKey(key: string): string {
    if (
      key === "" ||
      key.includes("\\") ||
      path.isAbsolute(key) ||
      key.split("/").some((segment) => segment === "" || segment === "." || segment === "..")
    ) {
      throw new AppError(400, "INVALID_STORAGE_KEY", "The storage key is invalid.");
    }
    const target = path.resolve(this.root, ...key.split("/"));
    const relative = path.relative(this.root, target);
    if (
      relative === "" ||
      relative.startsWith("..") ||
      path.isAbsolute(relative)
    ) {
      throw new AppError(400, "INVALID_STORAGE_KEY", "The storage key escapes its storage root.");
    }
    return target;
  }

  async save(input: SaveObjectInput): Promise<StoredObject> {
    if (!/^[a-z0-9]{1,10}$/.test(input.extension)) {
      throw new AppError(422, "INVALID_EXTENSION", "The derived media extension is invalid.");
    }
    const now = input.now ?? new Date();
    const datePath = [
      String(now.getUTCFullYear()),
      String(now.getUTCMonth() + 1).padStart(2, "0"),
      String(now.getUTCDate()).padStart(2, "0"),
    ];
    const key = [
      kindDirectory[input.kind],
      ...datePath,
      `${randomUUID()}.${input.extension}`,
    ].join("/");
    const target = this.resolveKey(key);
    const incomingDirectory = path.join(this.root, ".incoming");
    const incoming = path.join(incomingDirectory, `${randomUUID()}.tmp`);
    await Promise.all([
      mkdir(path.dirname(target), { recursive: true }),
      mkdir(incomingDirectory, { recursive: true }),
    ]);
    try {
      await copyFile(input.temporaryPath, incoming, constants.COPYFILE_EXCL);
      await rename(incoming, target);
      const details = await stat(target);
      return { provider: this.id, key, sizeBytes: details.size };
    } catch (error) {
      await rm(incoming, { force: true }).catch(() => undefined);
      throw error;
    }
  }

  async delete(key: string): Promise<void> {
    const target = this.resolveKey(key);
    try {
      await rm(target);
    } catch (error) {
      if (!isMissingFile(error)) throw error;
    }
  }

  async exists(key: string): Promise<boolean> {
    const target = this.resolveKey(key);
    try {
      return (await stat(target)).isFile();
    } catch (error) {
      if (isMissingFile(error)) return false;
      throw error;
    }
  }

  getPublicUrl(key: string): string {
    this.resolveKey(key);
    const encodedKey = key
      .split("/")
      .map((segment) => encodeURIComponent(segment))
      .join("/");
    return `${this.publicBaseUrl}/${encodedKey}`;
  }
}
