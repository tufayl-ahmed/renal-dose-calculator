const CACHE_VERSION = "renal-dose-pwa-v20260510-1";
const APP_SHELL_CACHE = `${CACHE_VERSION}-shell`;

const APP_SHELL_URLS = [
  "/",
  "/index.html",
  "/manifest.webmanifest",
  "/src/styles.css?v=20260510-2",
  "/src/app.js?v=20260510-2",
  "/src/renal.js",
  "/src/drugLookup.js?v=20260508-1",
  "/src/drugLookup.js?v=20260510-1",
  "/src/llmDoseAssist.js?v=20260510-1",
  "/src/drugNormalizer.js?v=20260508-2",
  "/src/drugNormalizer.js?v=20260506-8",
  "/src/drugNormalizer.js",
  "/src/quickInput.js?v=20260510-1",
  "/src/drugAutocomplete.js?v=20260509-2",
  "/src/drugAutocompleteData.js",
  "/src/doseGuidance.js?v=20260509-4",
  "/src/llmDoseAssistCore.js?v=20260509-2",
  "/assets/brand/renal-logo.png",
  "/assets/pwa/icon-192.png",
  "/assets/pwa/icon-512.png",
  "/assets/pwa/apple-touch-icon.png",
  "/assets/fonts/manrope-latin-variable.woff2",
  "/assets/fonts/geist-mono-latin-variable.woff2"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(APP_SHELL_CACHE)
      .then((cache) => cache.addAll(APP_SHELL_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith("renal-dose-pwa-") && !key.startsWith(CACHE_VERSION))
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) {
    return;
  }

  if (url.pathname.startsWith("/api/")) {
    event.respondWith(fetch(request));
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(networkFirstNavigation(request));
    return;
  }

  event.respondWith(staleWhileRevalidate(request));
});

async function networkFirstNavigation(request) {
  const cache = await caches.open(APP_SHELL_CACHE);
  try {
    const response = await fetch(request);
    cache.put(request, response.clone());
    return response;
  } catch {
    return (await cache.match(request)) || cache.match("/index.html");
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(APP_SHELL_CACHE);
  const cached = await cache.match(request);
  const network = fetch(request)
    .then((response) => {
      if (response.ok) {
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => cached);
  return cached || network;
}
