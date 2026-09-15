"use client";

import { useEffect } from "react";

/**
 * Registers the hand-rolled service worker (public/sw.js) in production
 * only - registering in dev would cache the dev server's HMR assets and
 * cause confusing stale-content bugs while iterating.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;

    navigator.serviceWorker.register("/sw.js").catch((error: unknown) => {
      console.error("Service worker registration failed:", error);
    });
  }, []);

  return null;
}
