"use client";

import type { AdminMediaDto, SiteSettingsAdminDto } from "@maglive/contracts";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AdminApiError } from "../auth/api";
import { MediaPicker } from "../media/MediaPicker";
import { SelectedMediaSummary } from "../media/SelectedMediaSummary";
import { getSiteSettings, updateSiteSettings } from "./api";

function messageFor(reason: unknown): string {
  return reason instanceof AdminApiError
    ? reason.message
    : "The browser icon settings could not be loaded or saved.";
}

export function SiteIconSettings() {
  const router = useRouter();
  const [settings, setSettings] = useState<SiteSettingsAdminDto | null>(null);
  const [iconMediaId, setIconMediaId] = useState<string | null>(null);
  const [selectedMedia, setSelectedMedia] = useState<AdminMediaDto | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void getSiteSettings()
      .then((next) => {
        if (!active) return;
        setSettings(next);
        setIconMediaId(next.iconMediaId ?? null);
        setError(null);
      })
      .catch((reason: unknown) => {
        if (active) setError(messageFor(reason));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const savedIconMediaId = settings?.iconMediaId ?? null;
  const dirty = settings !== null && savedIconMediaId !== iconMediaId;

  function choose(media: AdminMediaDto): void {
    setIconMediaId(media.id);
    setSelectedMedia(media);
    setPickerOpen(false);
    setNotice(null);
  }

  async function save(): Promise<void> {
    if (settings === null || !dirty) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const next = await updateSiteSettings(settings, iconMediaId);
      setSettings(next);
      setNotice(
        iconMediaId === null
          ? "Browser tab icon removed."
          : "Browser tab icon updated.",
      );
      router.refresh();
    } catch (reason) {
      setError(messageFor(reason));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="site-icon-settings" aria-labelledby="site-icon-title">
      <div className="site-icon-settings__heading">
        <div>
          <span className="admin-kicker">Site appearance</span>
          <h2 id="site-icon-title">Browser tab icon</h2>
          <p>
            Choose the favicon shown in browser tabs, bookmarks, and saved links.
            A square PNG or WebP image works best.
          </p>
        </div>
        <div className="site-icon-settings__actions">
          <button
            className="admin-button admin-button--quiet"
            disabled={loading || saving || settings === null}
            onClick={() => setPickerOpen(true)}
            type="button"
          >
            {iconMediaId === null ? "Choose icon" : "Replace icon"}
          </button>
          {iconMediaId !== null ? (
            <button
              className="admin-button admin-button--quiet"
              disabled={saving}
              onClick={() => {
                setIconMediaId(null);
                setSelectedMedia(null);
                setNotice(null);
              }}
              type="button"
            >
              Remove
            </button>
          ) : null}
          <button
            className="admin-button admin-button--primary"
            disabled={!dirty || saving}
            onClick={() => void save()}
            type="button"
          >
            {saving ? "Saving…" : "Save icon"}
          </button>
        </div>
      </div>

      {loading ? <p aria-live="polite">Loading browser icon…</p> : null}
      {!loading && settings !== null && iconMediaId === null ? (
        <div className="site-icon-settings__empty">
          <span aria-hidden="true">M</span>
          <div>
            <strong>No custom icon selected</strong>
            <p>The browser will use its default site icon.</p>
          </div>
        </div>
      ) : null}
      {!loading && settings !== null && iconMediaId !== null ? (
        <SelectedMediaSummary media={selectedMedia} mediaId={iconMediaId} />
      ) : null}
      {dirty ? (
        <small className="site-icon-settings__dirty">Unsaved change</small>
      ) : null}
      {error ? (
        <div className="admin-alert" role="alert">
          {error}
        </div>
      ) : null}
      {notice ? (
        <div className="admin-notice" role="status">
          {notice}
        </div>
      ) : null}

      {pickerOpen ? (
        <MediaPicker
          kind="image"
          onClose={() => setPickerOpen(false)}
          onSelect={choose}
          title="Choose browser tab icon"
          {...(iconMediaId === null ? {} : { selectedId: iconMediaId })}
        />
      ) : null}
    </section>
  );
}
