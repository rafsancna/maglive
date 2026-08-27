type ProductPathParts = Readonly<{
  slug: string;
  category: Readonly<{ slug: string }>;
}>;

export function productPath(product: ProductPathParts): string {
  return `/products/${product.category.slug}/${product.slug}`;
}
