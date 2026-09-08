"use client";

import { useState } from "react";

type ShareNetwork = "facebook" | "linkedin" | "telegram" | "whatsapp" | "x";

function articleUrl(): string {
  const url = new URL(window.location.href);
  url.hash = "";
  url.search = "";
  return url.toString();
}

function networkUrl(network: ShareNetwork, title: string, url: string): string {
  const encodedTitle = encodeURIComponent(title);
  const encodedUrl = encodeURIComponent(url);
  if (network === "facebook")
    return `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`;
  if (network === "linkedin")
    return `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`;
  if (network === "telegram")
    return `https://t.me/share/url?url=${encodedUrl}&text=${encodedTitle}`;
  if (network === "whatsapp")
    return `https://wa.me/?text=${encodedTitle}%20${encodedUrl}`;
  return `https://twitter.com/intent/tweet?text=${encodedTitle}&url=${encodedUrl}`;
}

export function NewsShare({
  title,
  excerpt,
}: {
  title: string;
  excerpt: string;
}) {
  const [copyState, setCopyState] = useState<"idle" | "copied" | "error">(
    "idle",
  );

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(articleUrl());
      setCopyState("copied");
      window.setTimeout(() => setCopyState("idle"), 2400);
    } catch {
      setCopyState("error");
    }
  }

  async function share() {
    if (navigator.share) {
      try {
        await navigator.share({ title, text: excerpt, url: articleUrl() });
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError")
          return;
      }
    }
    await copyLink();
  }

  function shareOn(network: ShareNetwork) {
    window.open(
      networkUrl(network, title, articleUrl()),
      "_blank",
      "noopener,noreferrer",
    );
  }

  const copyLabel =
    copyState === "copied"
      ? "Link copied"
      : copyState === "error"
        ? "Copy failed"
        : "Copy link";

  return (
    <section aria-label="Share this story" className="news-share">
      <header className="news-share__header">
        <div>
          <span>Share this story</span>
          <p>Pass this article along to your network.</p>
        </div>
        <button
          aria-label="Share this article"
          className="news-share__primary"
          onClick={share}
          type="button"
        >
          <svg aria-hidden="true" viewBox="0 0 24 24">
            <circle cx="18" cy="5" r="2.5" />
            <circle cx="6" cy="12" r="2.5" />
            <circle cx="18" cy="19" r="2.5" />
            <path d="m8.2 10.8 7.6-4.5M8.2 13.2l7.6 4.5" />
          </svg>
          <span>Share anywhere</span>
        </button>
      </header>
      <div className="news-share__actions" aria-label="Share directly">
        <button
          aria-label="Share on LinkedIn"
          className="news-share__network"
          onClick={() => shareOn("linkedin")}
          type="button"
        >
          <b aria-hidden="true">in</b>
          <span>LinkedIn</span>
        </button>
        <button
          aria-label="Share on X"
          className="news-share__network"
          onClick={() => shareOn("x")}
          type="button"
        >
          <b aria-hidden="true">X</b>
          <span>X</span>
        </button>
        <button
          aria-label="Share on Facebook"
          className="news-share__network"
          onClick={() => shareOn("facebook")}
          type="button"
        >
          <b aria-hidden="true">f</b>
          <span>Facebook</span>
        </button>
        <button
          aria-label="Share on WhatsApp"
          className="news-share__network"
          onClick={() => shareOn("whatsapp")}
          type="button"
        >
          <b aria-hidden="true">wa</b>
          <span>WhatsApp</span>
        </button>
        <button
          aria-label="Share on Telegram"
          className="news-share__network"
          onClick={() => shareOn("telegram")}
          type="button"
        >
          <b aria-hidden="true">tg</b>
          <span>Telegram</span>
        </button>
        <button className="news-share__copy" onClick={copyLink} type="button">
          <b aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <path d="M9 15 15 9M7.5 10.5l-1.4 1.4a3.7 3.7 0 0 0 5.2 5.2l1.4-1.4M16.5 13.5l1.4-1.4a3.7 3.7 0 1 0-5.2-5.2l-1.4 1.4" />
            </svg>
          </b>
          <span>{copyLabel}</span>
        </button>
      </div>
      <span aria-live="polite" className="news-share__status">
        {copyState === "copied"
          ? "The article link has been copied to your clipboard."
          : copyState === "error"
            ? "The article link could not be copied."
            : ""}
      </span>
    </section>
  );
}
