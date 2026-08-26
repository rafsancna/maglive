"use client";

import type { AdminMediaDto, MediaKind } from "@maglive/contracts";
import { useEffect, useState } from "react";
import { AdminApiError } from "../auth/api";
import { listMedia } from "./api";
import { MediaPreview } from "./MediaPreview";

export function MediaPicker({
  kind,
  selectedId,
  title = "Choose media",
  onSelect,
  onClose,
}: {
  kind?: MediaKind;
  selectedId?: string;
  title?: string;
  onSelect: (media: AdminMediaDto) => void;
  onClose: () => void;
}) {
  const [items, setItems] = useState<AdminMediaDto[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void listMedia({
      ...(kind === undefined ? {} : { kind }),
      search,
      limit: 100,
    })
      .then((result) => {
        if (active) {
          setItems(result.items.filter((item) => item.status === "ready"));
          setError(null);
        }
      })
      .catch((reason: unknown) => {
        if (active) {
          setError(
            reason instanceof AdminApiError
              ? reason.message
              : "The media library could not be loaded.",
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [kind, search]);

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
        onClick={onClose}
        type="button"
      />
      <div className="media-picker__panel">
        <header>
          <div>
            <span className="admin-kicker">Reusable assets</span>
            <h2 id="media-picker-title">{title}</h2>
          </div>
          <button
            aria-label="Close media picker"
            className="admin-button admin-button--quiet"
            onClick={onClose}
            type="button"
          >
            Close
          </button>
        </header>
        <label className="admin-field">
          <span>Search media</span>
          <input
            onChange={(event) => {
              setLoading(true);
              setSearch(event.target.value);
            }}
            placeholder="Search original filenames"
            type="search"
            value={search}
          />
        </label>
        {loading ? <p aria-live="polite">Loading media…</p> : null}
        {error === null ? null : (
          <div className="admin-alert" role="alert">
            {error}
          </div>
        )}
        {!loading && error === null && items.length === 0 ? (
          <p className="media-picker__empty">
            No ready {kind ?? "media"} assets match this search.
          </p>
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
              <span>{media.originalName}</span>
              <small>{media.kind}</small>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
