/*
 * Skeleton service worker: resilience on a flaky shared host.
 *
 * The contest host occasionally drops a request (Apache answers 500 after ten
 * seconds), which broke page loads at random. This worker makes every
 * same-origin GET resilient without touching the app:
 *
 *   - hedging: if no answer arrives quickly, a second identical request is
 *     sent and the first good answer wins; a 5xx or network error triggers an
 *     immediate retry (GET is idempotent, so this is always safe);
 *   - build assets (`/_next/static/…`, content-hashed and immutable) are
 *     cached after the first load, so later visits do not even ask the host.
 *
 * Writes (POST/PUT/PATCH/DELETE) and the realtime relay are never touched.
 */

const STATIC_CACHE = "skeleton-static-v1";
const MAX_ATTEMPTS = 3;

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) if (key !== STATIC_CACHE) await caches.delete(key);
      await self.clients.claim();
    })(),
  );
});

function hedgeDelay(request, url) {
  if (url.pathname.startsWith("/_next/static/")) return 2500;
  if (request.mode === "navigate") return 4000;
  return 3500;
}

/** First good response among up to MAX_ATTEMPTS identical GETs. */
function resilientFetch(request, url) {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    let pending = 0;
    let settled = false;
    let lastResponse = null;
    let lastError = null;
    let hedgeTimer = null;

    const finish = () => {
      if (settled || pending > 0 || attempts < MAX_ATTEMPTS) return;
      settled = true;
      if (lastResponse) resolve(lastResponse);
      else reject(lastError ?? new TypeError("network error"));
    };

    const attempt = () => {
      if (settled || attempts >= MAX_ATTEMPTS) return;
      attempts += 1;
      pending += 1;
      clearTimeout(hedgeTimer);
      hedgeTimer = setTimeout(attempt, hedgeDelay(request, url));
      fetch(request)
        .then((response) => {
          pending -= 1;
          if (settled) return;
          if (response.status < 500) {
            settled = true;
            clearTimeout(hedgeTimer);
            resolve(response);
            return;
          }
          lastResponse = response;
          if (attempts < MAX_ATTEMPTS) attempt();
          else finish();
        })
        .catch((error) => {
          pending -= 1;
          if (settled) return;
          lastError = error;
          if (attempts < MAX_ATTEMPTS) setTimeout(attempt, 300);
          else finish();
        });
    };

    attempt();
  });
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET" || request.headers.has("range")) return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/realtime/") || url.pathname.startsWith("/api/socket")) return;
  if (url.pathname === "/sw.js") return;

  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(STATIC_CACHE);
        const hit = await cache.match(request);
        if (hit) return hit;
        const response = await resilientFetch(request, url);
        if (response.ok) await cache.put(request, response.clone()).catch(() => undefined);
        return response;
      })(),
    );
    return;
  }

  event.respondWith(resilientFetch(request, url));
});
