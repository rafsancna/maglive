import type { AdminMediaDto, SeoScore, SeoScoreResponse } from "@maglive/contracts";
import { SelectedMediaSummary } from "../media/SelectedMediaSummary";
import { SeoScorePanel } from "./SeoScorePanel";

export type SeoEditorValue = {
  focusKeyphrase?: string | undefined;
  title?: string | undefined;
  description?: string | undefined;
  canonicalUrlOverride?: string | undefined;
  robots?: { index: boolean; follow: boolean } | undefined;
  openGraphTitle?: string | undefined;
  openGraphDescription?: string | undefined;
  openGraphMediaId?: string | undefined;
  keywords?: string[] | undefined;
};

export function SeoEditor({
  value,
  onChange,
  score,
  scoreLoading,
  engines,
  fieldError,
  openGraphMedia,
  onChooseOpenGraphMedia,
  onClearOpenGraphMedia,
}: {
  value: SeoEditorValue;
  onChange: (value: SeoEditorValue) => void;
  score?: SeoScore | undefined;
  scoreLoading?: boolean | undefined;
  engines?: SeoScoreResponse["engines"] | undefined;
  fieldError?: ((field: string) => string | undefined) | undefined;
  openGraphMedia?: AdminMediaDto | null | undefined;
  onChooseOpenGraphMedia: () => void;
  onClearOpenGraphMedia: () => void;
}) {
  const error = fieldError ?? (() => undefined);
  const update = <K extends keyof SeoEditorValue>(field: K, next: SeoEditorValue[K]) => {
    onChange({ ...value, [field]: next });
  };
  const robots = value.robots ?? { index: true, follow: true };
  return (
    <div className="seo-editor">
      <div className="product-editor__grid">
        <label className="admin-field product-editor__wide">
          <span>Focus keyphrase</span>
          <input value={value.focusKeyphrase ?? ""} onChange={(event) => update("focusKeyphrase", event.target.value)} />
          {error("focusKeyphrase") ? <em>{error("focusKeyphrase")}</em> : null}
        </label>
        <label className="admin-field product-editor__wide">
          <span>SEO title</span>
          <input value={value.title ?? ""} onChange={(event) => update("title", event.target.value)} />
          {error("title") ? <em>{error("title")}</em> : null}
        </label>
        <label className="admin-field product-editor__wide">
          <span>Meta description</span>
          <textarea rows={3} value={value.description ?? ""} onChange={(event) => update("description", event.target.value)} />
          {error("description") ? <em>{error("description")}</em> : null}
        </label>
        <label className="admin-field product-editor__wide">
          <span>Canonical URL override</span>
          <input inputMode="url" placeholder="Leave empty for the self-referencing URL" value={value.canonicalUrlOverride ?? ""} onChange={(event) => update("canonicalUrlOverride", event.target.value)} />
          {error("canonicalUrlOverride") ? <em>{error("canonicalUrlOverride")}</em> : null}
        </label>
        <label className="admin-field product-editor__wide">
          <span>Open Graph title</span>
          <input value={value.openGraphTitle ?? ""} onChange={(event) => update("openGraphTitle", event.target.value)} />
        </label>
        <label className="admin-field product-editor__wide">
          <span>Open Graph description</span>
          <textarea rows={3} value={value.openGraphDescription ?? ""} onChange={(event) => update("openGraphDescription", event.target.value)} />
        </label>
        <div className="admin-field product-editor__wide">
          <span>Open Graph image</span>
          {value.openGraphMediaId === undefined ? (
            <div className="selected-media-summary selected-media-summary--empty">
              <div className="selected-media-summary__placeholder" aria-hidden="true">IMG</div>
              <div><strong>No social image selected</strong><span>Choose a reusable image from the media library.</span></div>
            </div>
          ) : (
            <SelectedMediaSummary
              media={openGraphMedia}
              mediaId={value.openGraphMediaId}
            />
          )}
          <div className="selected-media-actions">
            <button className="admin-button admin-button--quiet" onClick={onChooseOpenGraphMedia} type="button">
              {value.openGraphMediaId === undefined ? "Choose social image" : "Replace social image"}
            </button>
            {value.openGraphMediaId === undefined ? null : (
              <button className="admin-button admin-button--quiet" onClick={onClearOpenGraphMedia} type="button">Clear image</button>
            )}
          </div>
        </div>
        <fieldset className="admin-fieldset">
          <legend>Robots</legend>
          <label className="admin-check"><input checked={robots.index} onChange={(event) => update("robots", { ...robots, index: event.target.checked })} type="checkbox" /> Index this page</label>
          <label className="admin-check"><input checked={robots.follow} onChange={(event) => update("robots", { ...robots, follow: event.target.checked })} type="checkbox" /> Follow links</label>
        </fieldset>
      </div>
      <SeoScorePanel loading={scoreLoading} score={score} />
      {engines ? <p className="seo-editor__engines">Internal checks active · Yoast {engines.yoastLocaleSupported ? "analysis active" : "fallback for this language"}</p> : null}
    </div>
  );
}
