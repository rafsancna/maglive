import { Suspense } from "react";
import { ProductWorkspace } from "@/admin/products/ProductWorkspace";

function ProductWorkspaceFallback() {
  return (
    <section aria-live="polite" className="product-workspace">
      <div className="product-loading">
        <span />
        <span />
        <span />
        Loading Product workspace…
      </div>
    </section>
  );
}

export default function AdminProductsPage() {
  return (
    <Suspense fallback={<ProductWorkspaceFallback />}>
      <ProductWorkspace />
    </Suspense>
  );
}
