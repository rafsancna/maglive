import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const isProduction = process.env.NODE_ENV === "production";
  return isProduction
    ? { rules: { userAgent: "*", allow: "/", disallow: ["/admin", "/api", "/uploads"] }, sitemap: new URL("/sitemap.xml", process.env.SITE_URL ?? "http://localhost:3000").toString() }
    : { rules: { userAgent: "*", disallow: "/" } };
}

