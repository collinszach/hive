import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.zacharyjcollins.hive",
  appName: "Hive",
  // Load from your live server instead of bundled assets.
  // Change this URL to your Cloudflare Tunnel or Tailscale hostname.
  server: {
    url: "https://hive.app",
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
