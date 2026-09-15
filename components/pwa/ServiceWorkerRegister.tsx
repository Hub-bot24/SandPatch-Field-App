"use client";

import { useEffect } from "react";
import { withBasePath } from "@/lib/config";

/**
 * Registers the hand-rolled service worker (public/sw.js) in production
 * only - registering in dev would cache the dev server's HMR assets and
 * cause confusing stale-content bugs while iterating. Registered with an
 * explicit scope matching basePath so it controls the whole app under a
 * GitHub Pages subpath, not just the root.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;

    navigator.serviceWorker
      .register(withBasePath("/sw.js"), { scope: withBasePath("/") })
      .catch((error: unknown) => {
        console.error("Service worker registration failed:", error);
      });
  }, []);

  return null;
}
