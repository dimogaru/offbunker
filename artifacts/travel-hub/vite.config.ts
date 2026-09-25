import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";
import { VitePWA } from "vite-plugin-pwa";

const rawPort = process.env.PORT;

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const basePath = process.env.BASE_PATH;

if (!basePath) {
  throw new Error(
    "BASE_PATH environment variable is required but was not provided.",
  );
}

export default defineConfig({
  base: basePath,
  plugins: [
    react(),
    tailwindcss(),
    runtimeErrorOverlay(),
    VitePWA({
      registerType: "autoUpdate",

      // ── Dev mode ────────────────────────────────────────────────────────
      // The Vite dev server serves JavaScript as un-bundled ES modules, so
      // there are no compiled files for Workbox to precache.  Enabling the
      // SW in dev mode produces a worker with an empty precache list that
      // cannot serve the app shell offline.  We disable it here and rely on
      // the production (built) service worker for real offline support.
      devOptions: {
        enabled: false,
      },

      // ── Assets to include alongside the auto-detected glob patterns ──────
      includeAssets: ["icon.svg", "icon-192.png", "icon-512.png", "apple-touch-icon.png", "favicon.svg", "opengraph.jpg", "robots.txt"],

      // ── Web App Manifest ─────────────────────────────────────────────────
      // vite-plugin-pwa automatically injects <link rel="manifest"> into the
      // built HTML, so no manual tag is needed in index.html.
      manifest: {
        name: "OffBunker",
        short_name: "OffBunker",
        description: "Gestiona tus viajes sin conexión a internet",
        theme_color: "#0f4a52",
        background_color: "#0f4a52",
        display: "standalone",
        start_url: "/login?mode=pwa",
        scope: "/",
        orientation: "portrait-primary",
        lang: "es",
        icons: [
          {
            src: "/icon.svg",
            sizes: "any",
            type: "image/svg+xml",
            purpose: "any",
          },
          {
            src: "/icon-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },

      // ── Workbox (generateSW strategy) ────────────────────────────────────
      workbox: {
        // ── App-shell navigation fallback ──────────────────────────────────
        // Any navigation to an unknown URL (e.g. /trips/42) is served the
        // cached index.html so the SPA router can handle it client-side.
        // API routes are excluded so they go to the network as normal.
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/api\//],

        // ── Precache: all built static assets ──────────────────────────────
        // Workbox scans the build output and injects a versioned manifest of
        // every matching file.  These are served Cache-First automatically;
        // no runtime rule is needed for them.
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff,woff2}"],

        // ── Immediate activation ───────────────────────────────────────────
        // Without these two flags a freshly installed SW enters "waiting"
        // state.  The user would need a second page load before the SW takes
        // control, meaning the very first offline refresh still fails.
        skipWaiting: true,
        clientsClaim: true,

        // ── Stale cache cleanup ────────────────────────────────────────────
        // Removes precache entries from previous build versions on activate,
        // preventing the device from being stuck on an outdated shell.
        cleanupOutdatedCaches: true,

        // ── Runtime caching ───────────────────────────────────────────────
        // IMPORTANT: /api/uploads/ must come BEFORE /api/ so uploaded files
        // use CacheFirst (offline-accessible) while all other API responses
        // use NetworkFirst (always-fresh data, 5 s timeout before stale).
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith("/api/uploads/"),
            handler: "CacheFirst",
            options: {
              cacheName: "travelhub-uploads-v2",
              expiration: {
                maxEntries: 300,
                maxAgeSeconds: 30 * 24 * 60 * 60,
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            urlPattern: ({ url }) => url.pathname.startsWith("/api/"),
            handler: "NetworkFirst",
            options: {
              cacheName: "travelhub-api-v1",
              expiration: {
                maxEntries: 500,
                maxAgeSeconds: 7 * 24 * 60 * 60,
              },
              networkTimeoutSeconds: 5,
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
        ],
      },
    }),
    ...(process.env.NODE_ENV !== "production" &&
    process.env.REPL_ID !== undefined
      ? [
          await import("@replit/vite-plugin-cartographer").then((m) =>
            m.cartographer({
              root: path.resolve(import.meta.dirname, ".."),
            }),
          ),
          await import("@replit/vite-plugin-dev-banner").then((m) =>
            m.devBanner(),
          ),
        ]
      : []),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "@assets": path.resolve(import.meta.dirname, "..", "..", "attached_assets"),
    },
    dedupe: ["react", "react-dom"],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
  },
  server: {
    port,
    strictPort: true,
    host: "0.0.0.0",
    allowedHosts: true,
    fs: {
      strict: true,
    },
  },
  preview: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
  },
});
