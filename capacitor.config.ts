// capacitor.config.ts
import type { CapacitorConfig } from "@capacitor/cli";
import { KeyboardResize } from "@capacitor/keyboard";

const config: CapacitorConfig = {
  appId: "au.ecodia.roam",
  appName: "Roam",

  // Static bundle built via `npm run build:static` → `out/`
  // Capacitor serves this from device storage - fully offline, no network required.
  webDir: "out",

  server: {
    cleartext: false,
    allowNavigation: ["*.ecodia.au", "*.supabase.co", "*.supabase.in"],
  },

  plugins: {
    SplashScreen: {
      // JS calls SplashScreen.hide() from NativeBootstrap once the app is
      // ready (~150ms after permissions). launchAutoHide acts as a safety
      // net: if the WebView crashes before React mounts, the OS will still
      // hide the splash after launchShowDuration so the user never sees a
      // permanent black screen.
      launchAutoHide: true,
      launchShowDuration: 3000,
      backgroundColor: "#A8431F",
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
      androidScaleType: "CENTER_CROP",
      androidSplashResourceName: "splash",
    },

    StatusBar: {
      style: "DARK",
      backgroundColor: "#00000000",
      overlaysWebView: true,
    },

    Keyboard: {
      // "body" resizes the WebView so content scrolls naturally above the keyboard.
      // Matches the runtime config in src/lib/native/keyboard.ts.
      resize: "body" as KeyboardResize,
      resizeOnFullScreen: true,
    },
  },

  ios: {
    contentInset: "never",
    backgroundColor: "#A8431F",
    preferredContentMode: "recommended",
    allowsLinkPreview: false,
    scrollEnabled: true,
  },

  android: {
    backgroundColor: "#A8431F",
    allowMixedContent: false,
  },
};

export default config;
