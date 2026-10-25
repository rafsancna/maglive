import type { NextConfig } from "next";
import { mediaOrigin } from "./src/lib/media-origin";

// The media origin is resolved from the environment at build time only to
// configure the image optimizer. Nothing else depends on it: media links are
// rewritten at request time in `src/lib/public-api.ts`, and country flags are
// always loaded from this site's own origin (`/flags/<country>.svg`).
const media = new URL(mediaOrigin());

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  transpilePackages: ["@maglive/contracts"],
  images: {
    // Self-hosted deployments regularly serve media from a private address, and
    // the deployment host is not known at build time. Optimization is limited to
    // the media paths below, so this cannot be used as a general-purpose proxy.
    dangerouslyAllowLocalIP: true,
    remotePatterns: [
      {
        protocol: media.protocol.replace(":", "") as "http" | "https",
        hostname: media.hostname,
        port: media.port,
        pathname: "/uploads/**"
      },
      // The configured media origin covers the normal case; these entries keep
      // optimized images working when the deployment moves to another domain or
      // IP address without a rebuild.
      { protocol: "https", hostname: "**", pathname: "/uploads/**" },
      { protocol: "http", hostname: "**", pathname: "/uploads/**" },
      {
        protocol: "https",
        hostname: "images.unsplash.com",
        pathname: "/**"
      }
    ]
  }
};

export default nextConfig;
