import type { AdminMediaDto } from "@maglive/contracts";
import Image from "next/image";

export function MediaPreview({
  media,
  compact = false,
}: {
  media: AdminMediaDto;
  compact?: boolean;
}) {
  if (media.kind === "image") {
    return (
      <Image
        alt={media.defaultTranslations.en?.alt ?? media.originalName}
        className="media-preview__asset"
        height={media.height ?? 800}
        sizes={compact ? "12rem" : "(max-width: 768px) 100vw, 40vw"}
        src={media.url}
        width={media.width ?? 1200}
      />
    );
  }
  if (media.kind === "video") {
    return (
      <video
        aria-label={media.originalName}
        className="media-preview__asset"
        controls={!compact}
        muted
        preload={compact ? "metadata" : "none"}
      >
        <source src={media.url} type={media.mimeType} />
      </video>
    );
  }
  return (
    <a
      className="media-preview__document"
      href={media.url}
      rel="noreferrer"
      target="_blank"
    >
      <span aria-hidden="true">PDF</span>
      <strong>Open document</strong>
    </a>
  );
}
