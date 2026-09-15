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
