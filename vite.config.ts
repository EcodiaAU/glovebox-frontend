import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { sentryVitePlugin } from "@sentry/vite-plugin";
import path from "path";
import { createHash } from "crypto";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "fs";

// Injects a content-derived build id into the service worker's CACHE_VERSION at
// build time. public/sw.js ships the literal "__BUILD_ID__"; after the bundle
// is written we replace it with a hash of the emitted asset filenames, so the
// service worker's bytes change on every deploy that changes content (and only
// then). A changed sw.js forces the browser to reinstall it, which purges the
// old cache and reloads controlled clients onto the fresh shell - closing the
// "cache frozen because nobody bumped the constant" failure. No-op deploys keep
// the same id, so they do not needlessly bust caches.
function swBuildId(): Plugin {
  return {
    name: "sw-build-id",
    apply: "build",
    closeBundle() {
      const outDir = path.resolve(__dirname, "out");
      const swPath = path.join(outDir, "sw.js");
      if (!existsSync(swPath)) return;
      const assetsDir = path.join(outDir, "assets");
      const assetNames = existsSync(assetsDir) ? readdirSync(assetsDir).sort() : [];
      const buildId = createHash("sha1").update(assetNames.join(",")).digest("hex").slice(0, 12);
      const sw = readFileSync(swPath, "utf8").replace(/__BUILD_ID__/g, buildId);
      writeFileSync(swPath, sw);
      // eslint-disable-next-line no-console
      console.log(`[sw-build-id] CACHE_VERSION -> glovebox-${buildId}`);
    },
  };
}

// Source-map upload runs only when SENTRY_AUTH_TOKEN is present (Vercel prod
// build). Debug IDs let Sentry unminify stack frames; maps (in outDir "out")
// are deleted after upload so they are never served publicly. org ecodia-l4 /
// project glovebox.
const uploadSourcemaps = !!process.env.SENTRY_AUTH_TOKEN;

export default defineConfig({
  plugins: [
    react({
      babel: {
        plugins: [["babel-plugin-react-compiler"]],
      },
    }),
    ...(uploadSourcemaps
      ? [
          sentryVitePlugin({
            org: "ecodia-l4",
            project: "glovebox",
            authToken: process.env.SENTRY_AUTH_TOKEN,
            release: { name: process.env.VITE_SENTRY_RELEASE || process.env.VERCEL_GIT_COMMIT_SHA },
            sourcemaps: { filesToDeleteAfterUpload: ["./out/**/*.map"] },
            telemetry: false,
          }),
        ]
      : []),
    swBuildId(),
  ],

  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },

  appType: "spa",

  optimizeDeps: {
    esbuildOptions: {
      target: "esnext",
    },
  },

  build: {
    target: "esnext",
    outDir: "out",
    sourcemap: uploadSourcemaps ? "hidden" : false,
    rollupOptions: {
      output: {
        manualChunks: {
          maplibre: ["maplibre-gl"],
          supabase: ["@supabase/supabase-js"],
          revenuecat: ["@revenuecat/purchases-capacitor"],
        },
      },
    },
  },

  server: {
    port: 3000,
    open: false,
  },
});
