// Hand-rolled service worker (no Workbox/next-pwa) so the offline caching
// behavior is small enough to fully reason about for a QA-evidence app.
//
// Strategy:
// - Navigations (HTML page loads / route changes): network-first, falling
//   back to the cache, and finally to the cached "/" app shell so an
//   offline visit to an unvisited route still renders the app.
// - Everything else same-origin (JS/CSS chunks, manifest, icons): cache
//   first, falling back to network and caching the result.
//
// This deliberately does NOT try to precache every hashed build asset -
// filenames change every deploy, so a hardcoded precache manifest tends to
// go stale. Instead the cache is populated as pages/assets are actually
// requested, which is enough to satisfy "works offline after first load":
// the first (online) visit naturally warms the cache for whatever the
// user opens.
//
// Bump CACHE_VERSION when this file's strategy changes so old caches are
// cleared on activate. This only ever touches the Cache Storage API for
// static assets - it never touches IndexedDB (job/records/photos), which
// lives in a completely separate storage area.
const CACHE_VERSION = "v1";
const CACHE_NAME = `sandpatch-cache-${CACHE_VERSION}`;

// Derived from this worker's own registration scope rather than
// hardcoded, so the same file works whether the app is served from the
// domain root (local dev, Vercel, ...) or a subpath (GitHub Pages project
// sites are served at /<repo-name>/) - next.config.ts's basePath stays
// the single source of truth for which one it is.
const BASE_PATH = (() => {
  try {
    const scopePath = new URL(self.registration.scope).pathname;
    return scopePath.endsWith("/") ? scopePath.slice(0, -1) : scopePath;
  } catch {
    return "";
  }
})();

// Known static routes, warmed at install time so the app shell is
// available offline even before every tab has been opened once.
const APP_SHELL_URLS = ["/", "/records/", "/records/view/", "/job/", "/export/"].map(
  (path) => `${BASE_PATH}${path}`,
);

// The tab that triggers installing this service worker is NOT controlled
// by it (browsers only hand control to a new SW from the next navigation
// onward), so that tab's own JS/CSS requests never pass through `fetch`
// below and never get runtime-cached. If the user then goes offline
// before a second navigation happens, those chunks would be missing.
// To close that gap, install fetches each app-shell page directly (a
// service worker can always `fetch` regardless of who controls what),
// scrapes the hashed asset URLs it references out of the HTML, and
// caches those too - without ever hardcoding a filename, so this stays
// correct across rebuilds where chunk hashes change.
self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(precacheAppShell());
});

async function precacheAppShell() {
  const cache = await caches.open(CACHE_NAME);
  const assetUrls = new Set();

  await Promise.allSettled(
    APP_SHELL_URLS.map(async (url) => {
      try {
        const response = await fetch(url);
        if (!response.ok) return;
        await cache.put(url, response.clone());
        const html = await response.text();
        // Matches "/_next/..." with or without a basePath prefix in front.
        for (const match of html.matchAll(/(?:src|href)="([^"]*\/_next\/[^"]+)"/g)) {
          assetUrls.add(match[1]);
        }
      } catch {
        // Best-effort: if a route can't be reached at install time, the
        // normal runtime cacheFirst/networkFirst handlers still cover it
        // once the user actually visits it while online.
      }
    }),
  );

  await Promise.allSettled(
    Array.from(assetUrls).map(async (assetUrl) => {
      try {
        const response = await fetch(assetUrl);
        if (response.ok) await cache.put(assetUrl, response.clone());
      } catch {
        // ignore - same best-effort reasoning as above
      }
    }),
  );
}

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET") {
    return;
  }
  let url;
  try {
    url = new URL(request.url);
  } catch {
    return;
  }
  if (url.origin !== self.location.origin) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request));
    return;
  }

  event.respondWith(cacheFirst(request));
});

async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const response = await fetch(request);
    if (response && response.ok) {
      await cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;
    const shell = await cache.match(`${BASE_PATH}/`);
    if (shell) return shell;
    return new Response("Offline and this page has not been cached yet.", {
      status: 503,
      statusText: "Offline",
      headers: { "Content-Type": "text/plain" },
    });
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response && response.ok) {
      await cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response("", { status: 504, statusText: "Offline and not yet cached" });
  }
}
