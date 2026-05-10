import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

test("PWA manifest is installable and icons exist", async () => {
  const manifest = JSON.parse(await readFile("manifest.webmanifest", "utf8"));

  assert.equal(manifest.name, "Renal Dose Calculator");
  assert.equal(manifest.display, "standalone");
  assert.equal(manifest.scope, "/");
  assert.ok(manifest.start_url.startsWith("/"));
  assert.ok(manifest.icons.some((icon) => icon.sizes === "192x192" && icon.type === "image/png"));
  assert.ok(manifest.icons.some((icon) => icon.sizes === "512x512" && icon.purpose.includes("maskable")));

  await access("assets/pwa/icon-192.png");
  await access("assets/pwa/icon-512.png");
  await access("assets/pwa/apple-touch-icon.png");
});

test("service worker precaches the app shell entry points", async () => {
  const serviceWorker = await readFile("sw.js", "utf8");

  assert.match(serviceWorker, /CACHE_VERSION/);
  assert.match(serviceWorker, /\/index\.html/);
  assert.match(serviceWorker, /\/src\/app\.js\?v=20260510-2/);
  assert.match(serviceWorker, /networkFirstNavigation/);
  assert.match(serviceWorker, /staleWhileRevalidate/);
});
