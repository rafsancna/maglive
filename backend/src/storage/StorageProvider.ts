import type { MediaKind } from "@maglive/contracts";

export type StorageProviderId = "local";

export type SaveObjectInput = Readonly<{
  temporaryPath: string;
  kind: MediaKind;
  extension: string;
  now?: Date;
}>;

export type StoredObject = Readonly<{
  provider: StorageProviderId;
  key: string;
  sizeBytes: number;
}>;

export interface StorageProvider {
  readonly id: StorageProviderId;
  save(input: SaveObjectInput): Promise<StoredObject>;
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
  getPublicUrl(key: string): string;
}
