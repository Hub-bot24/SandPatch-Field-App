import type { NextConfig } from "next";
import { BASE_PATH } from "./lib/config";

const nextConfig: NextConfig = {
  // Version 1 requires no backend: ship a fully static export that works
  // from the filesystem/cache alone once the service worker has cached it.
  output: "export",
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
  reactStrictMode: true,
  // Empty string locally/on a root-serving host; set to "/<repo-name>" for
  // GitHub Pages via NEXT_PUBLIC_BASE_PATH (see lib/config.ts).
  basePath: BASE_PATH,
};

export default nextConfig;
