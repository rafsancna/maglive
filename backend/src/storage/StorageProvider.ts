import type { MediaKind } from "@maglive/contracts";

export type StorageProviderId = string;

export type SaveObjectInput = Readonly<{
  temporaryPath: string;
  kind: MediaKind;
  extension: string;
  visibility?: "public" | "private";
  now?: Date;
}>;

export type StoredObject = Readonly<{
  provider: StorageProviderId;
  key: string;
  sizeBytes: number;
}>;

export type MaterializedObject = Readonly<{
  path: string;
  cleanup: () => Promise<void>;
}>;

export interface StorageProvider {
  readonly id: StorageProviderId;
  save(input: SaveObjectInput): Promise<StoredObject>;
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
  materialize?(key: string): Promise<MaterializedObject>;
  getPublicUrl(key: string): string;
}
