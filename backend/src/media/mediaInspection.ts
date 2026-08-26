import { open, stat } from "node:fs/promises";
import type { MediaKind } from "@maglive/contracts";
import { AppError } from "../errors/AppError.js";

export type InspectedMedia = Readonly<{
  kind: MediaKind;
  mimeType: string;
  extension: string;
  width?: number;
  height?: number;
}>;

const supportedMimeTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "video/mp4",
  "video/webm",
  "application/pdf",
]);

function isPrefix(buffer: Buffer, bytes: readonly number[]): boolean {
  return bytes.every((value, index) => buffer[index] === value);
}

function jpegDimensions(buffer: Buffer):
  | Readonly<{ width: number; height: number }>
  | undefined {
  if (!isPrefix(buffer, [0xff, 0xd8, 0xff])) return undefined;
  let offset = 2;
  const startOfFrame = new Set([
    0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce,
    0xcf,
  ]);
  while (offset + 9 < buffer.length) {
    if (buffer[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = buffer[offset + 1];
    if (marker === undefined) return undefined;
    if (marker === 0xd8 || marker === 0xd9) {
      offset += 2;
      continue;
    }
    const length = buffer.readUInt16BE(offset + 2);
    if (length < 2 || offset + length + 2 > buffer.length) return undefined;
    if (startOfFrame.has(marker)) {
      const height = buffer.readUInt16BE(offset + 5);
      const width = buffer.readUInt16BE(offset + 7);
      return width > 0 && height > 0 ? { width, height } : undefined;
    }
    offset += length + 2;
  }
  return undefined;
}

function webpDimensions(buffer: Buffer):
  | Readonly<{ width: number; height: number }>
  | undefined {
  if (
    buffer.length < 30 ||
    buffer.toString("ascii", 0, 4) !== "RIFF" ||
    buffer.toString("ascii", 8, 12) !== "WEBP"
  ) {
    return undefined;
  }
  const chunk = buffer.toString("ascii", 12, 16);
  if (chunk === "VP8X") {
    const width =
      1 + buffer[24]! + (buffer[25]! << 8) + (buffer[26]! << 16);
    const height =
      1 + buffer[27]! + (buffer[28]! << 8) + (buffer[29]! << 16);
    return { width, height };
  }
  if (
    chunk === "VP8 " &&
    isPrefix(buffer.subarray(23), [0x9d, 0x01, 0x2a])
  ) {
    return {
      width: buffer.readUInt16LE(26) & 0x3fff,
      height: buffer.readUInt16LE(28) & 0x3fff,
    };
  }
  if (chunk === "VP8L" && buffer[20] === 0x2f) {
    const packed = buffer.readUInt32LE(21);
    return {
      width: 1 + (packed & 0x3fff),
      height: 1 + ((packed >> 14) & 0x3fff),
    };
  }
  return undefined;
}

function invalidMedia(message: string): never {
  throw new AppError(422, "INVALID_MEDIA_FILE", message);
}

export async function inspectMediaFile(
  filePath: string,
  claimedMimeType: string,
): Promise<InspectedMedia> {
  const normalizedMimeType = claimedMimeType.toLowerCase();
  if (!supportedMimeTypes.has(normalizedMimeType)) {
    throw new AppError(
      415,
      "UNSUPPORTED_MEDIA_TYPE",
      "Only JPEG, PNG, WebP, MP4, WebM, and PDF files are supported.",
    );
  }
  const details = await stat(filePath);
  const headerLength = Math.min(details.size, 512 * 1024);
  const file = await open(filePath, "r");
  try {
    const header = Buffer.alloc(headerLength);
    await file.read(header, 0, header.length, 0);

    if (normalizedMimeType === "image/png") {
      if (
        header.length < 24 ||
        !isPrefix(header, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]) ||
        header.toString("ascii", 12, 16) !== "IHDR"
      ) {
        return invalidMedia("The uploaded file is not a valid PNG image.");
      }
      const width = header.readUInt32BE(16);
      const height = header.readUInt32BE(20);
      if (width === 0 || height === 0) {
        return invalidMedia("The PNG dimensions are invalid.");
      }
      return {
        kind: "image",
        mimeType: normalizedMimeType,
        extension: "png",
        width,
        height,
      };
    }

    if (normalizedMimeType === "image/jpeg") {
      const dimensions = jpegDimensions(header);
      if (dimensions === undefined) {
        return invalidMedia("The uploaded file is not a valid JPEG image.");
      }
      return {
        kind: "image",
        mimeType: normalizedMimeType,
        extension: "jpg",
        ...dimensions,
      };
    }

    if (normalizedMimeType === "image/webp") {
      const dimensions = webpDimensions(header);
      if (
        dimensions === undefined ||
        dimensions.width === 0 ||
        dimensions.height === 0
      ) {
        return invalidMedia("The uploaded file is not a valid WebP image.");
      }
      return {
        kind: "image",
        mimeType: normalizedMimeType,
        extension: "webp",
        ...dimensions,
      };
    }

    if (normalizedMimeType === "video/mp4") {
      if (
        header.length < 12 ||
        header.toString("ascii", 4, 8) !== "ftyp"
      ) {
        return invalidMedia("The uploaded file is not a valid MP4 video.");
      }
      return {
        kind: "video",
        mimeType: normalizedMimeType,
        extension: "mp4",
      };
    }

    if (normalizedMimeType === "video/webm") {
      if (!isPrefix(header, [0x1a, 0x45, 0xdf, 0xa3])) {
        return invalidMedia("The uploaded file is not a valid WebM video.");
      }
      return {
        kind: "video",
        mimeType: normalizedMimeType,
        extension: "webm",
      };
    }

    if (!header.toString("ascii", 0, 5).startsWith("%PDF-")) {
      return invalidMedia("The uploaded file is not a valid PDF document.");
    }
    const tailLength = Math.min(details.size, 4_096);
    const tail = Buffer.alloc(tailLength);
    await file.read(tail, 0, tailLength, Math.max(0, details.size - tailLength));
    if (!tail.toString("latin1").includes("%%EOF")) {
      return invalidMedia("The PDF document is truncated or invalid.");
    }
    return {
      kind: "document",
      mimeType: normalizedMimeType,
      extension: "pdf",
    };
  } finally {
    await file.close();
  }
}
