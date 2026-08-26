import type { NextConfig } from "next";

const mediaOrigin = new URL(
  process.env.MEDIA_PUBLIC_ORIGIN ?? "http://localhost:5000"
);

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  transpilePackages: ["@maglive/contracts"],
  images: {
    remotePatterns: [
      {
        protocol: mediaOrigin.protocol.replace(":", "") as "http" | "https",
        hostname: mediaOrigin.hostname,
        port: mediaOrigin.port,
        pathname: "/uploads/**"
      }
    ]
  }
};

export default nextConfig;
