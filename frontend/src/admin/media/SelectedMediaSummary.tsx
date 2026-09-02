"use client";

import type { AdminMediaDto } from "@maglive/contracts";
import { useEffect, useState } from "react";
import { getMedia } from "./api";
import { MediaPreview } from "./MediaPreview";

function formatBytes(bytes: number): string {
  if (bytes < 1_024) return `${bytes} B`;
  if (bytes < 1_024 * 1_024) return `${(bytes / 1_024).toFixed(1)} KB`;
  return `${(bytes / (1_024 * 1_024)).toFixed(1)} MB`;
}

function mediaDetails(media: AdminMediaDto): string {
  const details = [media.kind[0]!.toUpperCase() + media.kind.slice(1)];
  if (media.width !== undefined && media.height !== undefined) {
    details.push(`${media.width} × ${media.height}`);
  } else if (media.durationSeconds !== undefined) {
    details.push(`${Math.round(media.durationSeconds)} sec`);
  }
  details.push(formatBytes(media.sizeBytes));
  return details.join(" · ");
}

export function SelectedMediaSummary({
  mediaId,
  media,
}: {
  mediaId: string;
  media?: AdminMediaDto | null | undefined;
}) {
  const [loaded, setLoaded] = useState<{
    id: string;
    media: AdminMediaDto | null;
  }>();
  const supplied = media?.id === mediaId ? media : undefined;
  const resolved = supplied ?? (loaded?.id === mediaId ? loaded.media : null);
  const loading = supplied === undefined && loaded?.id !== mediaId;

  useEffect(() => {
    if (supplied !== undefined) return;
    let active = true;
    void getMedia(mediaId)
      .then((next) => {
        if (active) setLoaded({ id: mediaId, media: next });
      })
      .catch(() => {
        if (active) setLoaded({ id: mediaId, media: null });
      });
    return () => {
      active = false;
    };
  }, [mediaId, supplied]);

  if (resolved === null) {
    return (
      <div className="selected-media-summary selected-media-summary--unavailable">
        <div className="selected-media-summary__placeholder" aria-hidden="true">
          {loading ? "…" : "!"}
        </div>
        <div>
          <strong>{loading ? "Loading media preview…" : "Media unavailable"}</strong>
          <span>
            {loading
              ? "Fetching the selected asset details."
              : "Choose a different asset from the media library."}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="selected-media-summary">
      <div className="selected-media-summary__preview">
        <MediaPreview compact media={resolved} />
      </div>
      <div className="selected-media-summary__copy">
        <strong title={resolved.originalName}>{resolved.originalName}</strong>
        {resolved.defaultTranslations.en?.title ? (
          <span>{resolved.defaultTranslations.en.title}</span>
        ) : null}
        <small>{mediaDetails(resolved)}</small>
      </div>
    </div>
  );
}
