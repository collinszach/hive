import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.zacharyjcollins.saplyn",
  appName: "Saplyn",
  // Load from your live server instead of bundled assets.
  // Change this URL to your Cloudflare Tunnel or Tailscale hostname.
  server: {
    url: "https://hive.zacharyjcollins.com",
    cleartext: false,
  },
  ios: {
    scheme: "Saplyn",
    contentInset: "always",
    backgroundColor: "#09090E",
    preferredContentMode: "mobile",
  },
};

export default config;
