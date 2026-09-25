import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  server: { port: 5173 },
  preview: { port: 4173 },
  build: {
    rollupOptions: {
      input: { main: "index.html", review: "review.html" },
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
        globPatterns: ["**/*.{js,css,html,woff2,png,webmanifest}"],
        navigateFallback: "/index.html",
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
