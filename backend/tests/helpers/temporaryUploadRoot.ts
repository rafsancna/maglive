import { mkdtemp, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const PREFIX = "maglive-test-uploads-";

export async function createTemporaryUploadRoot(): Promise<string> {
  return mkdtemp(path.join(tmpdir(), PREFIX));
}

export async function removeTemporaryUploadRoot(directory: string): Promise<void> {
  const resolvedTemp = await realpath(tmpdir());
  const resolvedDirectory = await realpath(directory);
  const relative = path.relative(resolvedTemp, resolvedDirectory);
  const isDirectValidatedChild =
    relative !== "" &&
    !relative.startsWith("..") &&
    !path.isAbsolute(relative) &&
    path.basename(resolvedDirectory).startsWith(PREFIX);

  if (!isDirectValidatedChild) {
    throw new Error("Refusing to clean an unvalidated test upload directory.");
  }

  await rm(resolvedDirectory, { recursive: true, force: true });
}
