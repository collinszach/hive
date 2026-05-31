import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.zacharyjcollins.hive",
  appName: "Hive",
  // Fallback assets only; the WebView loads server.url (the live site). Epic 3 bundles the real app here.
  webDir: "public",
  // Load from your live server instead of bundled assets.
  // Remote-load against the live site (Epic 3 will switch to bundled assets; API stays remote).
  server: {
    url: "https://hive.zacharyjcollins.com",
    cleartext: false,
  },
  ios: {
    scheme: "Hive",
    contentInset: "always",
    backgroundColor: "#09090E",
    preferredContentMode: "mobile",
  },
};

export default config;
