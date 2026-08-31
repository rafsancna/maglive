import type { AdminMediaDto } from "@maglive/contracts";
import Image from "next/image";

export function MediaPreview({
  media,
  compact = false,
}: {
  media: AdminMediaDto;
  compact?: boolean;
}) {
  if (media.status !== "ready" || media.url === undefined) {
    return (
      <div className="media-preview__processing" role="status">
        <span>{media.status === "failed" ? "!" : `${media.progress ?? 0}%`}</span>
        <strong>{media.processingStage ?? media.status}</strong>
      </div>
    );
  }
  if (media.kind === "image") {
    const avif = media.variants?.filter((variant) => variant.mimeType === "image/avif");
    const webp = media.variants?.filter((variant) => variant.mimeType === "image/webp");
    const srcSet = (variants: typeof avif) =>
      variants?.map((variant) => `${variant.url} ${variant.width ?? media.width ?? 1}w`).join(", ");
    return (
      <picture>
        {avif && avif.length > 0 ? <source srcSet={srcSet(avif)} type="image/avif" /> : null}
        {webp && webp.length > 0 ? <source srcSet={srcSet(webp)} type="image/webp" /> : null}
        <Image
          alt={media.defaultTranslations.en?.alt ?? media.originalName}
          className="media-preview__asset"
          height={media.height ?? 800}
          sizes={compact ? "12rem" : "(max-width: 768px) 100vw, 40vw"}
          src={media.url}
          unoptimized
          width={media.width ?? 1200}
        />
      </picture>
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
        poster={media.generatedPoster?.url}
      >
        <source src={media.url} type={media.mimeType} />
      </video>
    );
  }
  if (compact) {
    return (
      <div className="media-preview__document">
        <span aria-hidden="true">PDF</span>
        <strong>PDF document</strong>
      </div>
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
