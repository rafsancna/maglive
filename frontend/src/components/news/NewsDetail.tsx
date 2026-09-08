import type {
  LocaleCode,
  NewsInlineContent,
  NewsMediaAlignment,
  NewsMediaAspectRatio,
  NewsMediaDisplaySize,
  NewsMediaFocalPoint,
  PublicNewsDetailDto,
  PublicNewsContentBlock,
} from "@maglive/contracts";
import type { ReactNode } from "react";
import {
  ResponsiveMediaImage,
  ResponsiveVideoSources,
} from "../media/ResponsiveMedia";
import { LocaleLink } from "../site/LocaleLink";
import { NewsShare } from "./NewsShare";

function richText(
  content: NewsInlineContent | undefined,
  fallback: string,
): ReactNode {
  if (content === undefined) return fallback;
  return content.map((node, index) => {
    if (node.type === "hardBreak") return <br key={`break-${index}`} />;
    let value: ReactNode = node.text;
    for (const mark of node.marks ?? []) {
      if (mark.type === "bold") value = <strong>{value}</strong>;
      else if (mark.type === "italic") value = <em>{value}</em>;
      else if (mark.type === "underline") value = <u>{value}</u>;
      else if (mark.type === "strike") value = <s>{value}</s>;
      else if (mark.type === "code") value = <code>{value}</code>;
      else if ("href" in mark)
        value = (
          <a
            href={mark.href}
            rel={mark.newWindow ? "noopener noreferrer" : undefined}
            target={mark.newWindow ? "_blank" : undefined}
          >
            {value}
          </a>
        );
    }
    return <span key={`text-${index}`}>{value}</span>;
  });
}

function alignmentClass(
  alignment: "left" | "center" | "right" | undefined,
): string | undefined {
  return alignment === undefined ? undefined : `news-body__align-${alignment}`;
}

type MediaPresentation = Readonly<{
  type: "image" | "video";
  displaySize?: NewsMediaDisplaySize | undefined;
  alignment?: NewsMediaAlignment | undefined;
  aspectRatio?: NewsMediaAspectRatio | undefined;
  focalPoint?: NewsMediaFocalPoint | undefined;
}>;

function mediaPresentation(block: MediaPresentation): {
  className: string;
  sizes: string;
} {
  const displaySize =
    block.displaySize ?? (block.type === "image" ? "medium" : "full");
  const alignment = block.alignment ?? "center";
  const aspectRatio = block.aspectRatio ?? "original";
  const focalPoint = block.focalPoint ?? "center";
  const desktopWidth = {
    compact: "340px",
    medium: "500px",
    large: "640px",
    full: "760px",
  }[displaySize];
  return {
    className: [
      "news-body__media",
      `news-body__media--size-${displaySize}`,
      `news-body__media--align-${alignment}`,
      `news-body__media--ratio-${aspectRatio}`,
      `news-body__media--focus-${focalPoint}`,
    ].join(" "),
    sizes: `(max-width: 720px) calc(100vw - 2.5rem), ${desktopWidth}`,
  };
}

function block(block: PublicNewsContentBlock) {
  if (block.type === "paragraph")
    return (
      <p className={alignmentClass(block.alignment)} key={block.id}>
        {richText(block.richText, block.text)}
      </p>
    );
  if (block.type === "heading")
    return block.level === 2 ? (
      <h2
        className={alignmentClass(block.alignment)}
        id={`section-${block.id}`}
        key={block.id}
      >
        {richText(block.richText, block.text)}
      </h2>
    ) : (
      <h3
        className={alignmentClass(block.alignment)}
        id={`section-${block.id}`}
        key={block.id}
      >
        {richText(block.richText, block.text)}
      </h3>
    );
  if (block.type === "quote")
    return (
      <blockquote key={block.id}>
        <p>{richText(block.richText, block.text)}</p>
        {block.attribution ? <cite>{block.attribution}</cite> : null}
      </blockquote>
    );
  if (block.type === "list") {
    const List = block.style === "numbered" ? "ol" : "ul";
    return (
      <List key={block.id}>
        {block.items.map((item, index) => (
          <li key={`${block.id}-${index}`}>
            {richText(block.richItems?.[index], item)}
          </li>
        ))}
      </List>
    );
  }
  if (block.type === "divider")
    return <hr className="news-body__divider" key={block.id} />;
  if (block.type === "image") {
    const presentation = mediaPresentation(block);
    return (
      <figure className={presentation.className} key={block.id}>
        <ResponsiveMediaImage
          alt={block.alt ?? ""}
          media={block.media}
          sizes={presentation.sizes}
        />
        {block.caption ? <figcaption>{block.caption}</figcaption> : null}
      </figure>
    );
  }
  if (block.type === "video") {
    const presentation = mediaPresentation(block);
    return (
      <figure className={presentation.className} key={block.id}>
        <video
          aria-label={block.alt ?? "News video"}
          controls
          playsInline
          preload="metadata"
        >
          <ResponsiveVideoSources
            fallbackMimeType={block.media.mimeType}
            fallbackUrl={block.media.url}
            variants={block.media.variants}
          />
        </video>
        {block.caption ? <figcaption>{block.caption}</figcaption> : null}
      </figure>
    );
  }
  if (block.type === "document")
    return (
      <a
        className="news-document"
        href={block.media.url}
        key={block.id}
        rel="noopener noreferrer"
        target="_blank"
      >
        <span aria-hidden="true">PDF</span>
        <div>
          <strong>{block.label}</strong>
          {block.description ? <p>{block.description}</p> : null}
          <small>View document · opens in a new window</small>
        </div>
        <b aria-hidden="true">↗</b>
      </a>
    );
  if (block.type === "link")
    return (
      <a
        className="news-external-link"
        href={block.url}
        key={block.id}
        rel={block.newWindow ? "noopener noreferrer" : undefined}
        target={block.newWindow ? "_blank" : undefined}
      >
        <div>
          <strong>{block.label}</strong>
          {block.description ? <p>{block.description}</p> : null}
        </div>
        <b aria-hidden="true">↗</b>
      </a>
    );
  return null;
}
export function NewsDetail({
  news,
  locale,
}: {
  news: PublicNewsDetailDto;
  locale: LocaleCode;
}) {
  const date = new Intl.DateTimeFormat(locale, { dateStyle: "long" }).format(
    new Date(news.publishedAt),
  );
  return (
    <main className="news-detail">
      <header
        className={`news-detail__hero${news.heroMedia ? " news-detail__hero--with-media" : ""}`}
      >
        {news.heroMedia ? (
          <figure aria-hidden="true" className="news-detail__backdrop">
            <ResponsiveMediaImage
              alt=""
              className="news-detail__backdrop-image"
              media={news.heroMedia}
              preload
              sizes="100vw"
            />
          </figure>
        ) : null}
        <div className="news-detail__hero-inner">
          <div className="news-detail__breadcrumbs">
            <LocaleLink href="/news" locale={locale}>
              News
            </LocaleLink>
            <span>/</span>
            <span>{news.category.replaceAll("-", " ")}</span>
          </div>
          <div className="news-detail__headline">
            <span>{news.category.replaceAll("-", " ")}</span>
            <h1>{news.title}</h1>
            <p>{news.excerpt}</p>
            <footer>
              <div>
                <strong>{news.authorName}</strong>
                <time dateTime={news.publishedAt}>{date}</time>
              </div>
              <span>{news.readingMinutes} min read</span>
            </footer>
          </div>
        </div>
      </header>
      <div className="news-detail__layout">
        <aside className="news-detail__meta">
          <div className="news-detail__meta-group">
            <span>Published</span>
            <strong>{date}</strong>
          </div>
          <div className="news-detail__meta-group">
            <span>Topics</span>
            <div className="news-detail__tags">
              {news.tags.map((tag) => (
                <span key={tag}>{tag}</span>
              ))}
            </div>
          </div>
          <LocaleLink
            className="news-detail__back-link"
            href="/news"
            locale={locale}
          >
            ← All news
          </LocaleLink>
        </aside>
        <div className="news-detail__content">
          <div className="news-body">{news.content.map(block)}</div>
          <NewsShare excerpt={news.excerpt} title={news.title} />
        </div>
      </div>
    </main>
  );
}
