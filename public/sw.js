/*
 * VisionKids service worker — deliberately conservative.
 *
 * IMPORTANT: this SW does NOT cache JS/CSS/hashed build assets. The app ships a
 * chunk-reload recovery handler (see src/main.tsx) and a SW that served stale
 * hashed chunks would fight it and could brick the app after a deploy. So we
 * only:
 *   1. precache a tiny offline fallback page, and
 *   2. on a failed NAVIGATION request, serve that fallback.
 * Everything else passes straight through to the network. This is enough for
 * installability + a friendly offline screen without any stale-asset risk.
 * (Richer offline content is served from IndexedDB by the app itself.)
 */
const CACHE = "visionkids-shell-v1";
const OFFLINE_URL = "/offline.html";

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.add(OFFLINE_URL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  // Only handle top-level navigations; let all asset/data requests hit network.
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req).catch(() => caches.match(OFFLINE_URL).then((r) => r || new Response("Offline", { status: 503 }))),
    );
  }
});

// Allow the app to trigger an immediate update.
self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});

// Best-effort push display (real push needs VAPID keys + a backend sender).
self.addEventListener("push", (event) => {
  let data = { title: "VisionKids", body: "You have a new update!" };
  try { if (event.data) data = { ...data, ...event.data.json() }; } catch { /* ignore */ }
  event.waitUntil(self.registration.showNotification(data.title, { body: data.body, icon: "/favicon.png", badge: "/favicon.png" }));
});
