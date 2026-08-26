import { access, writeFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  createTemporaryUploadRoot,
  removeTemporaryUploadRoot
} from "./helpers/temporaryUploadRoot.js";

describe("temporary upload test resources", () => {
  it("creates and removes only a generated test directory", async () => {
    const directory = await createTemporaryUploadRoot();
    await writeFile(path.join(directory, "fixture.bin"), "fixture", "utf8");
    await expect(access(directory)).resolves.toBeUndefined();
    await removeTemporaryUploadRoot(directory);
    await expect(access(directory)).rejects.toThrow();
  });
});
