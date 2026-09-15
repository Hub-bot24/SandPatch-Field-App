import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Version 1 requires no backend: ship a fully static export that works
  // from the filesystem/cache alone once the service worker has cached it.
  output: "export",
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
  reactStrictMode: true,
};

export default nextConfig;
