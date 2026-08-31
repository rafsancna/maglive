"use client";

import type { AdminMediaDto, MediaKind } from "@maglive/contracts";
import { useEffect, useRef, useState } from "react";
import { AdminApiError } from "../auth/api";
import { listMedia, uploadMedia, watchMediaProcessing } from "./api";
import { MediaPreview } from "./MediaPreview";
import { mediaStageLabel } from "./processing";

const MEDIA_KIND_COPY: Record<
  MediaKind,
  { label: string; singular: string; accept: string }
> = {
  image: {
    label: "Photos",
    singular: "photo",
    accept: ".jpg,.jpeg,.png,.webp",
  },
  video: { label: "Videos", singular: "video", accept: ".mp4,.webm" },
  document: {
    label: "Documents",
    singular: "document",
    accept: ".pdf",
  },
};

function mediaError(reason: unknown): string {
  if (!(reason instanceof AdminApiError)) {
    return "The media operation failed unexpectedly.";
  }
  if (reason.code === "UPLOAD_ABORTED") return "Upload cancelled.";
  if (reason.code === "API_UNAVAILABLE") {
    return "The CMS API is unavailable. Please retry the upload.";
  }
  return reason.message;
}

function mediaDetails(media: AdminMediaDto): string {
  if (media.kind === "image" && media.width && media.height) {
    return `${media.width} × ${media.height}`;
  }
  if (media.kind === "video" && media.durationSeconds !== undefined) {
    return `${Math.round(media.durationSeconds)} sec`;
  }
  return media.mimeType.replace("application/", "").toUpperCase();
}

export function MediaPicker({
  kind,
  selectedId,
  title = "Choose media",
  audioPolicy = "keep",
  onSelect,
  onClose,
}: {
  kind?: MediaKind;
  selectedId?: string;
  title?: string;
  audioPolicy?: "keep" | "remove";
  onSelect: (media: AdminMediaDto) => void;
  onClose: () => void;
}) {
  const [items, setItems] = useState<AdminMediaDto[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [processing, setProcessing] = useState<AdminMediaDto | null>(null);
  const uploadAbort = useRef<AbortController | null>(null);

  useEffect(() => {
    let active = true;
    void listMedia({
      ...(kind === undefined ? {} : { kind }),
      search,
      status: "ready",
      limit: 100,
    })
      .then((result) => {
        if (active) {
          setItems(result.items);
          setError(null);
        }
      })
      .catch((reason: unknown) => {
        if (active) setError(mediaError(reason));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [kind, search]);

  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent): void {
      if (event.key === "Escape" && !uploading) onClose();
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose, uploading]);

  async function uploadAndUse(file: File): Promise<void> {
    const controller = new AbortController();
    uploadAbort.current = controller;
    setUploading(true);
    setUploadProgress(0);
    setError(null);
    try {
      let uploaded = await uploadMedia(
        file,
        setUploadProgress,
        controller.signal,
        audioPolicy,
      );
      setUploadProgress(100);
      if (uploaded.status === "queued" || uploaded.status === "processing") {
        setProcessing(uploaded);
        uploaded = await watchMediaProcessing(uploaded.id, setProcessing, controller.signal);
      }
      if (uploaded.status === "failed") {
        setError(uploaded.processingError ?? "Media optimization failed.");
        return;
      }
      if (kind !== undefined && uploaded.kind !== kind) {
        setError(
          `${uploaded.originalName} was uploaded to ${MEDIA_KIND_COPY[uploaded.kind].label}, but this field requires a ${MEDIA_KIND_COPY[kind].singular}.`,
        );
        return;
      }
      onSelect(uploaded);
    } catch (reason) {
      setError(mediaError(reason));
    } finally {
      uploadAbort.current = null;
      setProcessing(null);
      setUploading(false);
    }
  }

  const categoryLabel =
    kind === undefined ? "All media" : MEDIA_KIND_COPY[kind].label;
  const acceptedFiles =
    kind === undefined
      ? Object.values(MEDIA_KIND_COPY)
          .map(({ accept }) => accept)
          .join(",")
      : MEDIA_KIND_COPY[kind].accept;

  return (
    <div
      aria-labelledby="media-picker-title"
      aria-modal="true"
      className="media-picker"
      role="dialog"
    >
      <button
        aria-label="Close media picker"
        className="media-picker__backdrop"
        disabled={uploading}
        onClick={onClose}
        type="button"
      />
      <div className="media-picker__panel">
        <header>
          <div>
            <span className="admin-kicker">Media library · {categoryLabel}</span>
            <h2 id="media-picker-title">{title}</h2>
            <p>Select an existing asset or upload a new one without leaving this page.</p>
          </div>
          <div className="media-picker__header-actions">
            <label className="admin-button admin-button--primary media-upload-button">
              <span>{uploading ? `${processing === null ? "Uploading" : "Optimizing"} ${processing?.progress ?? uploadProgress}%` : "Upload new"}</span>
              <input
                accept={acceptedFiles}
                aria-label={`Upload new ${kind === undefined ? "media" : MEDIA_KIND_COPY[kind].singular}`}
                disabled={uploading}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file !== undefined) void uploadAndUse(file);
                  event.target.value = "";
                }}
                type="file"
              />
            </label>
            <button
              aria-label="Close media picker"
              className="admin-button admin-button--quiet"
              disabled={uploading}
              onClick={onClose}
              type="button"
            >
              Close
            </button>
          </div>
        </header>

        {uploading ? (
          <div className="media-picker__upload" role="status">
            <div>
              <strong>{processing === null ? "Uploading and validating asset" : mediaStageLabel(processing)}</strong>
              <span>{processing?.progress ?? uploadProgress}%</span>
            </div>
            <progress max="100" value={processing?.progress ?? uploadProgress}>
              {processing?.progress ?? uploadProgress}%
            </progress>
            <button onClick={() => uploadAbort.current?.abort()} type="button">
              {processing === null ? "Cancel upload" : "Stop watching"}
            </button>
          </div>
        ) : null}

        <div className="media-picker__toolbar">
          <label className="admin-field">
            <span>Search {categoryLabel.toLowerCase()}</span>
            <input
              autoFocus
              onChange={(event) => {
                setLoading(true);
                setSearch(event.target.value);
              }}
              placeholder="Search by filename"
              type="search"
              value={search}
            />
          </label>
          <div className="media-picker__result-count" aria-live="polite">
            <strong>{items.length}</strong>
            <span>ready assets</span>
          </div>
        </div>

        {loading ? <p aria-live="polite">Loading media…</p> : null}
        {error === null ? null : (
          <div className="admin-alert" role="alert">
            {error}
          </div>
        )}
        {!loading && error === null && items.length === 0 ? (
          <div className="media-picker__empty">
            <strong>No {categoryLabel.toLowerCase()} found</strong>
            <p>Upload an approved asset here or change your search.</p>
          </div>
        ) : null}
        <div className="media-picker__grid">
          {items.map((media) => (
            <button
              aria-pressed={media.id === selectedId}
              key={media.id}
              onClick={() => onSelect(media)}
              type="button"
            >
              <MediaPreview compact media={media} />
              <span>{media.defaultTranslations.en?.title ?? media.originalName}</span>
              <small>{media.originalName} · {mediaDetails(media)}</small>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
