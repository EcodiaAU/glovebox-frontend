import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { sentryVitePlugin } from "@sentry/vite-plugin";
import path from "path";

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
