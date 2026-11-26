import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  server: { port: 5173 },
  preview: { port: 4173 },
  build: {
    rollupOptions: {
      input: { landing: "index.html", app: "app/index.html", review: "review.html", notFound: "404.html" },
    },
    outDir: "dist",
    // Hashed bundles live in /static (cached forever); /assets holds public files.
    assetsDir: "static",
    target: "es2022",
    sourcemap: true,
  },
  plugins: [
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: false,
      // The manifest is maintained by hand in public/manifest.webmanifest.
      manifest: false,
      workbox: {
        // A new deploy's worker takes over at once instead of waiting for every
        // tab to close. The plugin only adds these itself when it injects the
        // registration; src/ui/pwa.js registers the worker by hand.
        skipWaiting: true,
        clientsClaim: true,
        globPatterns: ["**/*.{js,css,html,woff2,png,webmanifest}"],
        navigateFallback: "/app/index.html",
        navigateFallbackDenylist: [/^\/api\//],
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith("/api/"),
            handler: "NetworkOnly",
          },
        ],
      },
    }),
  ],
});
