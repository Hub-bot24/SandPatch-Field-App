import type { MetadataRoute } from "next";

// Required for static export - see the "Route Handlers" section of the
// Next.js static-exports guide (app/manifest.ts compiles to a route
// handler under the hood).
export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "SandPatch Field App",
    short_name: "SandPatch",
    description:
      "Offline-first sand patch texture depth field data capture for road surfacing QA.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait-primary",
    background_color: "#101826",
    theme_color: "#101826",
    categories: ["utilities", "productivity"],
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
