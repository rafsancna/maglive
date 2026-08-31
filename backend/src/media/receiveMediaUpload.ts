import { createHash } from "node:crypto";
import { createWriteStream } from "node:fs";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import path from "node:path";
import Busboy from "busboy";
import type { Request } from "express";
import type { AppConfig } from "../config/env.js";
import { AppError } from "../errors/AppError.js";

export type ReceivedMediaUpload = Readonly<{
  temporaryDirectory: string;
  temporaryPath: string;
  originalName: string;
  claimedMimeType: string;
  sizeBytes: number;
  checksum: string;
  audioPolicy: "keep" | "remove";
}>;

const claimedLimits = new Map<string, keyof Pick<
  AppConfig,
  "maxImageBytes" | "maxVideoBytes" | "maxDocumentBytes"
>>([
  ["image/jpeg", "maxImageBytes"],
  ["image/png", "maxImageBytes"],
  ["image/webp", "maxImageBytes"],
  ["video/mp4", "maxVideoBytes"],
  ["video/webm", "maxVideoBytes"],
  ["application/pdf", "maxDocumentBytes"],
]);

function safeOriginalName(filename: string): string {
  const normalized = path.basename(filename.replaceAll("\\", "/"));
  const cleaned = [...normalized]
    .filter((character) => {
      const codePoint = character.codePointAt(0) ?? 0;
      return codePoint >= 32 && codePoint !== 127;
    })
    .join("")
    .trim();
  return (cleaned === "" ? "upload" : cleaned).slice(0, 255);
}

export async function removeReceivedUpload(
  upload: Pick<ReceivedMediaUpload, "temporaryDirectory">,
): Promise<void> {
  await rm(upload.temporaryDirectory, { recursive: true, force: true });
}

export async function receiveMediaUpload(
  request: Request,
  config: AppConfig,
): Promise<ReceivedMediaUpload> {
  const temporaryRoot = path.resolve(config.uploadRoot, ".temporary");
  await mkdir(temporaryRoot, { recursive: true });
  const temporaryDirectory = await mkdtemp(
    path.join(temporaryRoot, "request-"),
  );
  const temporaryPath = path.join(temporaryDirectory, "upload.part");

  try {
    return await new Promise<ReceivedMediaUpload>((resolve, reject) => {
      let parser: ReturnType<typeof Busboy>;
      try {
        parser = Busboy({
          headers: request.headers,
          limits: {
            fieldNameSize: 100,
            fields: 1,
            files: 2,
            fileSize: Math.max(
              config.maxImageBytes,
              config.maxVideoBytes,
              config.maxDocumentBytes,
            ),
            parts: 3,
          },
        });
      } catch {
        reject(
          new AppError(
            415,
            "MULTIPART_REQUIRED",
            "Upload requests must use multipart/form-data.",
          ),
        );
        return;
      }

      let fileCount = 0;
      let failure: Error | undefined;
      let result: Omit<ReceivedMediaUpload, "audioPolicy"> | undefined;
      let audioPolicy: ReceivedMediaUpload["audioPolicy"] = "keep";
      const writes: Promise<void>[] = [];

      const fail = (error: Error): void => {
        failure ??= error;
      };

      parser.on("file", (fieldName, file, info) => {
        fileCount += 1;
        if (fileCount > 1 || fieldName !== "file") {
          fail(
            new AppError(
              422,
              "ONE_FILE_REQUIRED",
              "Upload exactly one file using the file field.",
            ),
          );
          file.resume();
          return;
        }

        const claimedMimeType = info.mimeType.toLowerCase();
        const limitKey = claimedLimits.get(claimedMimeType);
        if (limitKey === undefined) {
          fail(
            new AppError(
              415,
              "UNSUPPORTED_MEDIA_TYPE",
              "Only JPEG, PNG, WebP, MP4, WebM, and PDF files are supported.",
            ),
          );
          file.resume();
          return;
        }
        const byteLimit = config[limitKey];
        const writer = createWriteStream(temporaryPath, { flags: "wx" });
        const checksum = createHash("sha256");
        let sizeBytes = 0;
        let stopped = false;

        const writeCompleted = new Promise<void>((writeResolve, writeReject) => {
          writer.once("error", writeReject);
          writer.once("finish", () => {
            if (!stopped) {
              result = {
                temporaryDirectory,
                temporaryPath,
                originalName: safeOriginalName(info.filename),
                claimedMimeType,
                sizeBytes,
                checksum: checksum.digest("hex"),
              };
            }
            writeResolve();
          });
        });
        writes.push(writeCompleted);

        file.on("data", (chunk: Buffer) => {
          if (stopped) return;
          sizeBytes += chunk.length;
          if (sizeBytes > byteLimit) {
            stopped = true;
            fail(
              new AppError(
                413,
                "MEDIA_TOO_LARGE",
                "The uploaded file exceeds its configured size limit.",
              ),
            );
            writer.end();
            return;
          }
          checksum.update(chunk);
          if (!writer.write(chunk)) {
            file.pause();
            writer.once("drain", () => file.resume());
          }
        });
        file.once("limit", () => {
          if (!stopped) {
            stopped = true;
            fail(
              new AppError(
                413,
                "MEDIA_TOO_LARGE",
                "The uploaded file exceeds its configured size limit.",
              ),
            );
            writer.end();
          }
        });
        file.once("error", (error) => {
          fail(error);
          if (!stopped) {
            stopped = true;
            writer.end();
          }
        });
        file.once("end", () => {
          if (!stopped) writer.end();
        });
      });

      parser.on("field", (fieldName, value) => {
        if (fieldName !== "audioPolicy" || (value !== "keep" && value !== "remove")) {
          fail(
            new AppError(
              422,
              "INVALID_UPLOAD_OPTION",
              "Only audioPolicy=keep or audioPolicy=remove is accepted.",
            ),
          );
          return;
        }
        audioPolicy = value;
      });
      parser.once("fieldsLimit", () => {
        fail(new AppError(422, "UNEXPECTED_UPLOAD_FIELD", "Only one upload option is accepted."));
      });
      parser.once("partsLimit", () => {
        fail(
          new AppError(
            422,
            "ONE_FILE_REQUIRED",
            "Upload exactly one file per request.",
          ),
        );
      });
      parser.once("error", () => {
        fail(
          new AppError(
            400,
            "INVALID_MULTIPART",
            "The multipart upload is incomplete or invalid.",
          ),
        );
      });
      request.once("aborted", () => {
        fail(
          new AppError(
            400,
            "UPLOAD_ABORTED",
            "The upload was interrupted before completion.",
          ),
        );
      });
      parser.once("close", () => {
        void Promise.allSettled(writes).then((writeResults) => {
          const rejected = writeResults.find(
            (candidate) => candidate.status === "rejected",
          );
          if (rejected?.status === "rejected") {
            reject(rejected.reason);
          } else if (failure !== undefined) {
            reject(failure);
          } else if (fileCount !== 1 || result === undefined) {
            reject(
              new AppError(
                422,
                "ONE_FILE_REQUIRED",
                "Upload exactly one file using the file field.",
              ),
            );
          } else {
            resolve({ ...result, audioPolicy });
          }
        });
      });

      request.pipe(parser);
    });
  } catch (error) {
    await rm(temporaryDirectory, { recursive: true, force: true });
    throw error;
  }
}
