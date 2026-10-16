/// <reference lib="webworker" />
/**
 * Service worker (G10 installable web app; built to /public/sw.js by @serwist/next, registered by
 * components/career/mobile/CareerMobileRoot.tsx). See docs/career_suite_mobile.md.
 *
 * Privacy rule: it caches ONLY the build's static files (/_next/static, hashed and identical for everyone), fonts,
 * public images and the offline page. It never caches API responses (same-origin /api/* or the API on another
 * origin), page HTML, React Server Component payloads or anything else that can carry a user's data: those
 * requests have no route here and go straight to the network.
 */
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { CacheFirst, ExpirationPlugin, NetworkOnly, Serwist, StaleWhileRevalidate } from "serwist";

declare global {
  interface ServiceWorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const OFFLINE_URL = "/career-offline.html";

// Precache only the offline page and app icon: precaching every build chunk would cost megabytes on a slow line
const precache = (self.__SW_MANIFEST ?? []).filter((e) => {
  const url = typeof e === "string" ? e : e.url;
  return url === OFFLINE_URL || url === "/career-icon.svg";
});

const serwist = new Serwist({
  precacheEntries: precache,
  // The page asks before switching versions (update prompt), so a new worker waits
  skipWaiting: false,
  clientsClaim: true,
  navigationPreload: false,
  runtimeCaching: [
    {
      // Hashed build files: safe to keep, never change
      matcher: ({ sameOrigin, url }) => sameOrigin && url.pathname.startsWith("/_next/static/"),
      handler: new CacheFirst({
        cacheName: "career-static",
        plugins: [new ExpirationPlugin({ maxEntries: 300, maxAgeSeconds: 30 * 24 * 60 * 60 })],
      }),
    },
    {
      // Public images and fonts served from /public (not /_next/image, which may proxy a school's or user's image)
      matcher: ({ sameOrigin, url }) =>
        sameOrigin && !url.pathname.startsWith("/api/") && !url.pathname.startsWith("/_next/") && /\.(?:png|svg|ico|webp|jpg|jpeg|woff2?)$/i.test(url.pathname),
      handler: new StaleWhileRevalidate({
        cacheName: "career-public",
        plugins: [new ExpirationPlugin({ maxEntries: 60, maxAgeSeconds: 7 * 24 * 60 * 60 })],
      }),
    },
    {
      // Pages: always from the network (they render per user); offline page when there is no connection
      matcher: ({ request, sameOrigin }) => sameOrigin && request.mode === "navigate",
      handler: new NetworkOnly(),
    },
  ],
  fallbacks: {
    entries: [{ url: OFFLINE_URL, matcher: ({ request }) => request.mode === "navigate" }],
  },
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") void self.skipWaiting();
});

// Remove caches from the earlier default setup, which also stored API responses and pages
self.addEventListener("activate", (event) => {
  const keep = (name: string) => name.startsWith("career-") || name.startsWith("serwist-precache");
  event.waitUntil(caches.keys().then((names) => Promise.all(names.filter((n) => !keep(n)).map((n) => caches.delete(n)))));
});

serwist.addEventListeners();
