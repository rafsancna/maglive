import type { NextConfig } from "next";

const mediaOrigin = new URL(
  process.env.MEDIA_PUBLIC_ORIGIN ?? "http://localhost:5000"
);
const isLoopbackMediaOrigin = ["localhost", "127.0.0.1", "[::1]"].includes(
  mediaOrigin.hostname
);

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  transpilePackages: ["@maglive/contracts"],
  images: {
    dangerouslyAllowLocalIP: isLoopbackMediaOrigin,
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
