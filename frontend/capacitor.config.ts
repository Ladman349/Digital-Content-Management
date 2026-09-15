import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Native shell for the CMS. The same Vite bundle that Vercel serves is copied into the app, so the
 * iPhone build is the board you already know, with the API URL baked in from frontend/.env at build
 * time. Nothing here knows about the player: that is the Android project under /android.
 */
const config: CapacitorConfig = {
  appId: "com.grovitai.signage",
  appName: "Signage CMS",
  webDir: "dist",
  ios: {
    // The web view runs edge to edge; the board pads itself with env(safe-area-inset-*).
    contentInset: "never",
    backgroundColor: "#0B0B0C",
    // Pinch-zooming a control surface only ever happens by accident.
    allowsLinkPreview: false,
    scrollEnabled: true,
  },
  // Both shells serve the bundle from a fixed origin — https://localhost on Android,
  // capacitor://localhost on iOS — which the API allow-lists in backend/main.py.
  android: {
    backgroundColor: "#0B0B0C",
    allowMixedContent: false,
  },
  plugins: {
    StatusBar: {
      // Light glyphs over the near-black ground; ThemeModeProvider flips this when the theme does.
      style: "DARK",
      overlaysWebView: true,
    },
    SplashScreen: {
      launchAutoHide: true,
      launchShowDuration: 400,
      backgroundColor: "#0B0B0C",
      showSpinner: false,
    },
  },
};

export default config;
