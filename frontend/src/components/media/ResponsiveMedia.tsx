import type { MediaVariantDto, PublicMediaDto } from "@maglive/contracts";
import Image from "next/image";

type ImageMedia = Pick<PublicMediaDto, "url" | "width" | "height" | "variants">;

function srcSet(variants: readonly MediaVariantDto[], mimeType: string): string | undefined {
  const candidates = variants
    .filter((variant) => variant.mimeType === mimeType && variant.width !== undefined)
    .sort((left, right) => left.width! - right.width!);
  return candidates.length === 0
    ? undefined
    : candidates.map((variant) => `${variant.url} ${variant.width}w`).join(", ");
}

export function ResponsiveMediaImage({ media, alt, className, sizes, preload = false }: {
  media: ImageMedia;
  alt: string;
  className?: string;
  sizes: string;
  preload?: boolean;
}) {
  const variants = media.variants ?? [];
  const avif = srcSet(variants, "image/avif");
  const webp = srcSet(variants, "image/webp");
  return <picture className={className}>
    {avif === undefined ? null : <source sizes={sizes} srcSet={avif} type="image/avif" />}
    {webp === undefined ? null : <source sizes={sizes} srcSet={webp} type="image/webp" />}
    <Image alt={alt} className={className} height={media.height ?? 900} sizes={sizes} src={media.url} unoptimized width={media.width ?? 1200} {...(preload ? { fetchPriority: "high" as const, loading: "eager" as const } : {})} />
  </picture>;
}

export function ResponsiveVideoSources({ variants, fallbackUrl, fallbackMimeType }: {
  variants?: readonly MediaVariantDto[] | undefined;
  fallbackUrl: string;
  fallbackMimeType: string;
}) {
  const videos = (variants ?? []).filter((variant) => variant.mimeType === "video/mp4").sort((left, right) => (left.height ?? 0) - (right.height ?? 0));
  const mobile = videos.find((variant) => variant.height === 720) ?? videos[0];
  const desktop = videos.find((variant) => variant.height === 1080) ?? videos.at(-1);
  const large = videos.find((variant) => variant.height === 1440);
  return <>
    {large === undefined ? null : <source media="(min-width: 1600px)" src={large.url} type={large.mimeType} />}
    {mobile === undefined ? null : <source media="(max-width: 767px)" src={mobile.url} type={mobile.mimeType} />}
    {desktop === undefined ? null : <source src={desktop.url} type={desktop.mimeType} />}
    <source src={fallbackUrl} type={fallbackMimeType} />
  </>;
}
