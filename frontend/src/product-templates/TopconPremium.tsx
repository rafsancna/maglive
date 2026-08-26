import type { ProductTemplateProps } from "./types";
import Image from "next/image";
import { EnquiryCta, ProductBreadcrumb, ProductDownloads, ProductMedia, ProductVideos, RelatedProducts, ProductSpecifications } from "@/components/product/ProductComponents";

export function TopconPremiumTemplate({ product }: ProductTemplateProps) {
  const hero = product.media.find((item) => item.role === "hero");
  return <article className="product-page product-page--premium"><header className="premium-hero"><ProductBreadcrumb product={product} /><span className="eyebrow">Topcon premium series</span><h1>{product.name}</h1><p>{product.shortDescription}</p>{hero ? <Image src={hero.url} alt={hero.alt ?? product.name} width={hero.width ?? 1200} height={hero.height ?? 900} priority sizes="100vw" /> : null}</header><section className="premium-technology"><h2>Technology</h2><p>{product.longDescriptionMarkdown ?? product.shortDescription}</p></section>{product.advantages.length > 0 ? <section className="premium-advantages"><h2>Advantages</h2><div>{product.advantages.map((item) => <article key={item.key}><strong>{item.title}</strong><p>{item.body}</p></article>)}</div></section> : null}<ProductSpecifications groups={product.specifications} /><ProductMedia product={product} /><ProductVideos product={product} /><ProductDownloads product={product} /><RelatedProducts product={product} /><EnquiryCta locale={product.locale} /></article>;
}
